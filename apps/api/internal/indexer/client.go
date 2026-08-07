// Package indexer reads bounties from the Goldsky subgraph, keeping RPC
// usage out of the serving path entirely.
package indexer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/FjrREPO/gitbounty/apps/api/internal/domain"
)

const bountiesQuery = `{
  bounties(first: 1000, orderBy: bountyId, orderDirection: desc) {
    bountyId
    repo
    issueNumber
    funder
    amount
    rewardUsdCents
    status
    expiresAt
  }
}`

// Client fetches indexed bounties over GraphQL.
type Client struct {
	url  string
	http *http.Client
}

// NewClient targets a Goldsky subgraph GraphQL endpoint.
func NewClient(url string) *Client {
	return &Client{url: url, http: &http.Client{Timeout: 15 * time.Second}}
}

type gqlBounty struct {
	BountyID       string `json:"bountyId"`
	Repo           string `json:"repo"`
	IssueNumber    string `json:"issueNumber"`
	Funder         string `json:"funder"`
	Amount         string `json:"amount"`
	RewardUsdCents string `json:"rewardUsdCents"`
	Status         string `json:"status"`
	ExpiresAt      string `json:"expiresAt"`
}

type gqlResponse struct {
	Data struct {
		Bounties []gqlBounty `json:"bounties"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

// FetchAll returns every indexed bounty, newest first.
func (c *Client) FetchAll(ctx context.Context) ([]domain.Bounty, error) {
	body, err := json.Marshal(map[string]string{"query": bountiesQuery})
	if err != nil {
		return nil, fmt.Errorf("marshal query: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("query subgraph: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("subgraph returned %s", res.Status)
	}

	var parsed gqlResponse
	if err := json.NewDecoder(res.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if len(parsed.Errors) > 0 {
		return nil, fmt.Errorf("subgraph error: %s", parsed.Errors[0].Message)
	}

	bounties := make([]domain.Bounty, 0, len(parsed.Data.Bounties))
	for _, raw := range parsed.Data.Bounties {
		bounty, err := toDomain(raw)
		if err != nil {
			return nil, err
		}
		bounties = append(bounties, bounty)
	}
	return bounties, nil
}

func toDomain(raw gqlBounty) (domain.Bounty, error) {
	id, err := strconv.ParseUint(raw.BountyID, 10, 64)
	if err != nil {
		return domain.Bounty{}, fmt.Errorf("invalid bountyId %q", raw.BountyID)
	}
	issue, err := strconv.ParseUint(raw.IssueNumber, 10, 64)
	if err != nil {
		return domain.Bounty{}, fmt.Errorf("invalid issueNumber %q", raw.IssueNumber)
	}
	cents, err := strconv.ParseUint(raw.RewardUsdCents, 10, 64)
	if err != nil {
		return domain.Bounty{}, fmt.Errorf("invalid rewardUsdCents %q", raw.RewardUsdCents)
	}
	expires, err := strconv.ParseInt(raw.ExpiresAt, 10, 64)
	if err != nil {
		return domain.Bounty{}, fmt.Errorf("invalid expiresAt %q", raw.ExpiresAt)
	}
	return domain.Bounty{
		ID:             id,
		Repo:           raw.Repo,
		IssueNumber:    issue,
		Funder:         raw.Funder,
		AmountWei:      raw.Amount,
		RewardUsdCents: cents,
		Status:         domain.Status(strings.ToLower(raw.Status)),
		ExpiresAt:      expires,
	}, nil
}
