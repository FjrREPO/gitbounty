package domain

// RepoStats is the cached GitHub repository statistics for a bounty's repo.
type RepoStats struct {
	Repo         string `json:"repo"`
	Description  string `json:"description"`
	Language     string `json:"language"`
	Stars        int64  `json:"stars"`
	Forks        int64  `json:"forks"`
	OpenIssues   int64  `json:"openIssues"`
	Commits      int64  `json:"commits"`
	PullRequests int64  `json:"pullRequests"`
	PushedAt     string `json:"pushedAt"`
}

// Label is a GitHub issue label.
type Label struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

// IssueMeta is the cached metadata of the GitHub issue a bounty targets.
type IssueMeta struct {
	Number      uint64  `json:"number"`
	Title       string  `json:"title"`
	State       string  `json:"state"`
	AuthorLogin string  `json:"authorLogin"`
	Comments    int64   `json:"comments"`
	Labels      []Label `json:"labels"`
}

// Contributor is a top contributor of a repository.
type Contributor struct {
	Login         string `json:"login"`
	AvatarURL     string `json:"avatarUrl"`
	Contributions int64  `json:"contributions"`
}

// GitHubMeta bundles everything the web needs to render a bounty's GitHub
// identity without touching the GitHub API from the browser.
type GitHubMeta struct {
	Repo         *RepoStats    `json:"repo,omitempty"`
	Issue        *IssueMeta    `json:"issue,omitempty"`
	Contributors []Contributor `json:"contributors"`
}
