export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;
  excerpt?: string;
  slug: string;
  publishedAt: Date;
  updatedAt: Date;
  status: 'draft' | 'published' | 'archived';
  tags: string[];
  viewCount: number;
}

export interface Comment {
  id: number;
  postId: number;
  authorId: number;
  content: string;
  parentId?: number;
  createdAt: Date;
  updatedAt: Date;
  isApproved: boolean;
  likeCount: number;
}