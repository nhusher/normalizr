import { schema } from '../../src/index.js';

// Entity types for the input data
export interface UserInput {
  id: string;
  name: string;
}

export interface CommentInput {
  id: string;
  content: string;
  commenter: UserInput;
}

export interface PostInput {
  id: string;
  title: string;
  author: UserInput;
  comments: CommentInput[];
}

// Extended types with relationship tracking (after normalization)
export interface UserWithRelationships extends UserInput {
  posts?: string[];
  comments?: string[];
}

export interface CommentWithRelationships extends Omit<CommentInput, 'commenter'> {
  commenter: string;
  post?: string;
}

/**
 * Custom process strategy that adds reverse relationship tracking to users.
 * When a user is found as an author, we track which posts they authored.
 * When a user is found as a commenter, we track which comments they made.
 */
const userProcessStrategy = (
  value: UserInput,
  parent: PostInput | CommentInput,
  key: string,
): UserWithRelationships => {
  switch (key) {
    case 'author':
      return { ...value, posts: [(parent as PostInput).id] };
    case 'commenter':
      return { ...value, comments: [(parent as CommentInput).id] };
    default:
      return { ...value };
  }
};

/**
 * Custom merge strategy that combines relationship arrays when the same user
 * appears multiple times (e.g., as author of multiple posts or multiple comments).
 */
const userMergeStrategy = (
  entityA: UserWithRelationships,
  entityB: UserWithRelationships,
): UserWithRelationships => {
  return {
    ...entityA,
    ...entityB,
    posts: [...(entityA.posts || []), ...(entityB.posts || [])],
    comments: [...(entityA.comments || []), ...(entityB.comments || [])],
  };
};

export const user = new schema.Entity<'users', UserWithRelationships>(
  'users',
  {},
  {
    mergeStrategy: userMergeStrategy,
    processStrategy: userProcessStrategy as (
      value: UserWithRelationships,
      parent: unknown,
      key: string | undefined,
    ) => UserWithRelationships,
  },
);

export const comment = new schema.Entity<'comments', CommentWithRelationships>(
  'comments',
  {
    commenter: user,
  },
  {
    processStrategy: (value, parent) => {
      return { ...value, post: (parent as PostInput).id } as CommentWithRelationships;
    },
  },
);

export const post = new schema.Entity<'posts', PostInput>('posts', {
  author: user,
  comments: [comment],
});

export default new schema.Array(post);
