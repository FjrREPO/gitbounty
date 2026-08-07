// Package chain reads GitBounty state from the escrow contract over
// JSON-RPC. It is the only package aware of EVM encodings.
package chain

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/FjrREPO/gitbounty/apps/api/internal/domain"
)

const escrowABI = `[
  {
    "name": "nextBountyId",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }]
  },
  {
    "name": "getBounty",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{ "name": "bountyId", "type": "uint256" }],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          { "name": "funder", "type": "address" },
          { "name": "issueNumber", "type": "uint64" },
          { "name": "expiresAt", "type": "uint64" },
          { "name": "status", "type": "uint8" },
          { "name": "rewardUsdCents", "type": "uint128" },
          { "name": "amount", "type": "uint256" },
          { "name": "repo", "type": "string" }
        ]
      }
    ]
  }
]`

// rawBounty mirrors the ABI tuple layout of IGitBountyEscrow.Bounty.
type rawBounty struct {
	Funder         common.Address
	IssueNumber    uint64
	ExpiresAt      uint64
	Status         uint8
	RewardUsdCents *big.Int
	Amount         *big.Int
	Repo           string
}

// EscrowClient reads bounties from a deployed GitBountyEscrow.
type EscrowClient struct {
	eth     *ethclient.Client
	abi     abi.ABI
	address common.Address
}

// NewEscrowClient dials the RPC endpoint and prepares the contract ABI.
func NewEscrowClient(rpcURL, escrowAddress string) (*EscrowClient, error) {
	if !common.IsHexAddress(escrowAddress) {
		return nil, fmt.Errorf("invalid escrow address %q", escrowAddress)
	}
	parsed, err := abi.JSON(strings.NewReader(escrowABI))
	if err != nil {
		return nil, fmt.Errorf("parse escrow abi: %w", err)
	}
	eth, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("dial rpc: %w", err)
	}
	return &EscrowClient{eth: eth, abi: parsed, address: common.HexToAddress(escrowAddress)}, nil
}

// Close releases the underlying RPC connection.
func (c *EscrowClient) Close() {
	c.eth.Close()
}

// NextBountyID returns the id the next bounty will receive.
func (c *EscrowClient) NextBountyID(ctx context.Context) (uint64, error) {
	out, err := c.call(ctx, "nextBountyId")
	if err != nil {
		return 0, err
	}
	next, ok := out[0].(*big.Int)
	if !ok {
		return 0, fmt.Errorf("unexpected nextBountyId type %T", out[0])
	}
	return next.Uint64(), nil
}

// Bounty fetches a single bounty by id.
func (c *EscrowClient) Bounty(ctx context.Context, id uint64) (domain.Bounty, error) {
	out, err := c.call(ctx, "getBounty", new(big.Int).SetUint64(id))
	if err != nil {
		return domain.Bounty{}, err
	}
	raw := *abi.ConvertType(out[0], new(rawBounty)).(*rawBounty)
	return toDomain(id, raw), nil
}

// FetchAll returns every bounty ever created, newest first. It satisfies
// sync.Source as the RPC fallback when no subgraph is configured.
func (c *EscrowClient) FetchAll(ctx context.Context) ([]domain.Bounty, error) {
	next, err := c.NextBountyID(ctx)
	if err != nil {
		return nil, err
	}
	bounties := make([]domain.Bounty, 0, next-1)
	for id := next - 1; id >= 1; id-- {
		bounty, err := c.Bounty(ctx, id)
		if err != nil {
			return nil, err
		}
		bounties = append(bounties, bounty)
	}
	return bounties, nil
}

func (c *EscrowClient) call(ctx context.Context, method string, args ...any) ([]any, error) {
	input, err := c.abi.Pack(method, args...)
	if err != nil {
		return nil, fmt.Errorf("pack %s: %w", method, err)
	}
	output, err := c.eth.CallContract(ctx, ethereum.CallMsg{To: &c.address, Data: input}, nil)
	if err != nil {
		return nil, fmt.Errorf("call %s: %w", method, err)
	}
	out, err := c.abi.Unpack(method, output)
	if err != nil {
		return nil, fmt.Errorf("unpack %s: %w", method, err)
	}
	return out, nil
}

func toDomain(id uint64, raw rawBounty) domain.Bounty {
	return domain.Bounty{
		ID:             id,
		Repo:           raw.Repo,
		IssueNumber:    raw.IssueNumber,
		Funder:         raw.Funder.Hex(),
		AmountWei:      raw.Amount.String(),
		RewardUsdCents: raw.RewardUsdCents.Uint64(),
		Status:         domain.StatusFromCode(raw.Status),
		ExpiresAt:      int64(raw.ExpiresAt),
	}
}
