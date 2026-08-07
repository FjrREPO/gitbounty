package indexer

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/FjrREPO/gitbounty/apps/api/internal/domain"
)

func TestFetchAllParsesSubgraphResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		_, _ = w.Write([]byte(`{
			"data": {
				"bounties": [
					{
						"bountyId": "2",
						"repo": "acme/demo",
						"issueNumber": "42",
						"funder": "0x3b4f0135465d444a5bd06ab90fc59b73916c85f5",
						"amount": "500000000000000000",
						"rewardUsdCents": "5000",
						"status": "OPEN",
						"expiresAt": "1800000000"
					}
				]
			}
		}`))
	}))
	defer srv.Close()

	bounties, err := NewClient(srv.URL).FetchAll(context.Background())
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if len(bounties) != 1 {
		t.Fatalf("len = %d", len(bounties))
	}
	got := bounties[0]
	if got.ID != 2 || got.Status != domain.StatusOpen || got.AmountWei != "500000000000000000" {
		t.Fatalf("unexpected bounty: %+v", got)
	}
}

func TestFetchAllSurfacesGraphQLErrors(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"errors":[{"message":"indexing in progress"}]}`))
	}))
	defer srv.Close()

	if _, err := NewClient(srv.URL).FetchAll(context.Background()); err == nil {
		t.Fatal("expected error")
	}
}

func TestFetchAllRejectsMalformedNumbers(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"data":{"bounties":[{"bountyId":"not-a-number"}]}}`))
	}))
	defer srv.Close()

	if _, err := NewClient(srv.URL).FetchAll(context.Background()); err == nil {
		t.Fatal("expected error")
	}
}
