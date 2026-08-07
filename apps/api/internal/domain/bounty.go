// Package domain defines the API's core types, independent of transport
// and chain concerns.
package domain

// Status mirrors the escrow contract's bounty lifecycle.
type Status string

const (
	StatusNone      Status = "none"
	StatusOpen      Status = "open"
	StatusPaid      Status = "paid"
	StatusReclaimed Status = "reclaimed"
)

// StatusFromCode maps the on-chain enum to its API representation.
func StatusFromCode(code uint8) Status {
	switch code {
	case 1:
		return StatusOpen
	case 2:
		return StatusPaid
	case 3:
		return StatusReclaimed
	default:
		return StatusNone
	}
}

// Bounty is an escrowed reward attached to a GitHub issue.
type Bounty struct {
	ID             uint64 `json:"id"`
	Repo           string `json:"repo"`
	IssueNumber    uint64 `json:"issueNumber"`
	Funder         string `json:"funder"`
	AmountWei      string `json:"amountWei"`
	RewardUsdCents uint64 `json:"rewardUsdCents"`
	Status         Status `json:"status"`
	ExpiresAt      int64  `json:"expiresAt"`
}

// Provider is an LLM option for the bring-your-own-key model picker.
type Provider struct {
	Name         string `json:"name"`
	DefaultModel string `json:"defaultModel,omitempty"`
}
