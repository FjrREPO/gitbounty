// Package github fetches repository, issue, and contributor metadata from
// the GitHub REST API. It runs server-side only, so one (optionally
// authenticated) quota serves every visitor.
package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"time"

	"github.com/FjrREPO/gitbounty/apps/api/internal/domain"
)

const defaultBaseURL = "https://api.github.com"

// ErrNotFound means GitHub has no such repository or issue.
var ErrNotFound = errors.New("github resource not found")

var lastPagePattern = regexp.MustCompile(`[?&]page=(\d+)>; rel="last"`)

// Client is a minimal GitHub REST client.
type Client struct {
	http    *http.Client
	baseURL string
	token   string
}

// NewClient builds a client; token may be empty (60 req/h unauthenticated).
func NewClient(token string) *Client {
	return &Client{
		http:    &http.Client{Timeout: 10 * time.Second},
		baseURL: defaultBaseURL,
		token:   token,
	}
}

// NewClientWithBaseURL is used by tests to point at a stub server.
func NewClientWithBaseURL(token, baseURL string) *Client {
	c := NewClient(token)
	c.baseURL = baseURL
	return c
}

// RepoStats fetches repository statistics, including commit and PR totals.
func (c *Client) RepoStats(ctx context.Context, repo string) (domain.RepoStats, error) {
	var raw struct {
		Description string `json:"description"`
		Language    string `json:"language"`
		Stars       int64  `json:"stargazers_count"`
		Forks       int64  `json:"forks_count"`
		OpenIssues  int64  `json:"open_issues_count"`
		PushedAt    string `json:"pushed_at"`
	}
	if _, err := c.get(ctx, "/repos/"+repo, &raw); err != nil {
		return domain.RepoStats{}, err
	}

	commits, err := c.countViaLastPage(ctx, "/repos/"+repo+"/commits", nil)
	if err != nil {
		commits = 0
	}
	pulls, err := c.countViaLastPage(ctx, "/repos/"+repo+"/pulls", url.Values{"state": {"all"}})
	if err != nil {
		pulls = 0
	}

	return domain.RepoStats{
		Repo:         repo,
		Description:  raw.Description,
		Language:     raw.Language,
		Stars:        raw.Stars,
		Forks:        raw.Forks,
		OpenIssues:   raw.OpenIssues,
		Commits:      commits,
		PullRequests: pulls,
		PushedAt:     raw.PushedAt,
	}, nil
}

// Issue fetches the metadata of a single issue.
func (c *Client) Issue(ctx context.Context, repo string, number uint64) (domain.IssueMeta, error) {
	var raw struct {
		Title    string         `json:"title"`
		State    string         `json:"state"`
		Comments int64          `json:"comments"`
		Labels   []domain.Label `json:"labels"`
		User     *struct {
			Login string `json:"login"`
		} `json:"user"`
	}
	path := fmt.Sprintf("/repos/%s/issues/%d", repo, number)
	if _, err := c.get(ctx, path, &raw); err != nil {
		return domain.IssueMeta{}, err
	}
	issue := domain.IssueMeta{
		Number:   number,
		Title:    raw.Title,
		State:    raw.State,
		Comments: raw.Comments,
		Labels:   raw.Labels,
	}
	if raw.User != nil {
		issue.AuthorLogin = raw.User.Login
	}
	return issue, nil
}

// Contributors fetches the top contributors of a repository.
func (c *Client) Contributors(ctx context.Context, repo string, max int) ([]domain.Contributor, error) {
	var raw []struct {
		Login         string `json:"login"`
		AvatarURL     string `json:"avatar_url"`
		Contributions int64  `json:"contributions"`
	}
	path := "/repos/" + repo + "/contributors?per_page=" + strconv.Itoa(max)
	if _, err := c.get(ctx, path, &raw); err != nil {
		return nil, err
	}
	contributors := make([]domain.Contributor, 0, len(raw))
	for _, item := range raw {
		contributors = append(contributors, domain.Contributor{
			Login:         item.Login,
			AvatarURL:     item.AvatarURL,
			Contributions: item.Contributions,
		})
	}
	return contributors, nil
}

// countViaLastPage reads an endpoint's total item count from the Link
// header's last-page marker (per_page=1), costing a single request.
func (c *Client) countViaLastPage(ctx context.Context, path string, params url.Values) (int64, error) {
	if params == nil {
		params = url.Values{}
	}
	params.Set("per_page", "1")

	var items []json.RawMessage
	header, err := c.get(ctx, path+"?"+params.Encode(), &items)
	if err != nil {
		return 0, err
	}
	if match := lastPagePattern.FindStringSubmatch(header.Get("Link")); match != nil {
		return strconv.ParseInt(match[1], 10, 64)
	}
	return int64(len(items)), nil
}

func (c *Client) get(ctx context.Context, path string, out any) (http.Header, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("build request %s: %w", path, err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	res, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github %s: %w", path, err)
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("%s: %w", path, ErrNotFound)
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github %s returned %s", path, res.Status)
	}
	if err := json.NewDecoder(res.Body).Decode(out); err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	return res.Header, nil
}
