import { schema } from '../../src/index.js';

// GitHub API types (simplified)
export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  url: string;
  type: string;
}

export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string;
}

export interface GitHubMilestone {
  id: number;
  number: number;
  title: string;
  description: string;
  creator: GitHubUser;
  state: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  user: GitHubUser;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  labels: GitHubLabel[];
  milestone: GitHubMilestone | null;
  state: string;
  pull_request?: { url: string };
}

export interface GitHubPullRequest extends GitHubIssue {
  pull_request: { url: string };
}

export const user = new schema.Entity<'users', GitHubUser>('users');

export const label = new schema.Entity<'labels', GitHubLabel>('labels');

export const milestone = new schema.Entity<'milestones', GitHubMilestone>('milestones', {
  creator: user,
});

export const issue = new schema.Entity<'issues', GitHubIssue>('issues', {
  assignee: user,
  assignees: [user],
  labels: [label],
  milestone,
  user,
});

export const pullRequest = new schema.Entity<'pullRequests', GitHubPullRequest>('pullRequests', {
  assignee: user,
  assignees: [user],
  labels: [label],
  milestone,
  user,
});

export const issueOrPullRequest = new schema.Array(
  {
    issues: issue,
    pullRequests: pullRequest,
  },
  (entity) => ((entity as GitHubIssue).pull_request ? 'pullRequests' : 'issues'),
);
