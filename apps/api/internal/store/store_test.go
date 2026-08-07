package store

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/FjrREPO/gitbounty/apps/api/internal/domain"
)

func testStore(t *testing.T) *Store {
	t.Helper()
	st, err := Open(":memory:")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return st
}

func sample(id uint64, status domain.Status) domain.Bounty {
	return domain.Bounty{
		ID:             id,
		Repo:           "acme/demo",
		IssueNumber:    42,
		Funder:         "0x3B4f0135465d444a5bD06Ab90fC59B73916C85F5",
		AmountWei:      "500000000000000000",
		RewardUsdCents: 5000,
		Status:         status,
		ExpiresAt:      1_800_000_000,
	}
}

func TestReplaceAndList(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()
	syncedAt := time.Unix(1_753_700_000, 0).UTC()

	bounties := []domain.Bounty{sample(2, domain.StatusOpen), sample(1, domain.StatusPaid)}
	if err := st.ReplaceBounties(ctx, bounties, syncedAt); err != nil {
		t.Fatalf("replace: %v", err)
	}

	got, err := st.ListBounties(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(got) != 2 || got[0].ID != 2 || got[1].ID != 1 {
		t.Fatalf("unexpected list order: %+v", got)
	}
	if got[1].Status != domain.StatusPaid {
		t.Fatalf("status not persisted: %+v", got[1])
	}

	last, err := st.LastSyncedAt(ctx)
	if err != nil {
		t.Fatalf("last synced: %v", err)
	}
	if !last.Equal(syncedAt) {
		t.Fatalf("synced at = %v, want %v", last, syncedAt)
	}
}

// Regression: a re-sync must fully replace stale rows, not accumulate them.
func TestReplaceIsIdempotent(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	if err := st.ReplaceBounties(ctx, []domain.Bounty{sample(1, domain.StatusOpen)}, time.Now()); err != nil {
		t.Fatalf("first replace: %v", err)
	}
	if err := st.ReplaceBounties(ctx, []domain.Bounty{sample(1, domain.StatusPaid)}, time.Now()); err != nil {
		t.Fatalf("second replace: %v", err)
	}

	got, err := st.ListBounties(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(got) != 1 || got[0].Status != domain.StatusPaid {
		t.Fatalf("expected single paid bounty, got %+v", got)
	}
}

func TestGetBounty(t *testing.T) {
	st := testStore(t)
	ctx := context.Background()

	if err := st.ReplaceBounties(ctx, []domain.Bounty{sample(7, domain.StatusOpen)}, time.Now()); err != nil {
		t.Fatalf("replace: %v", err)
	}

	got, err := st.GetBounty(ctx, 7)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Repo != "acme/demo" || got.AmountWei != "500000000000000000" {
		t.Fatalf("unexpected bounty: %+v", got)
	}

	if _, err := st.GetBounty(ctx, 999); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestLastSyncedAtBeforeAnySync(t *testing.T) {
	st := testStore(t)
	last, err := st.LastSyncedAt(context.Background())
	if err != nil {
		t.Fatalf("last synced: %v", err)
	}
	if !last.IsZero() {
		t.Fatalf("expected zero time, got %v", last)
	}
}
