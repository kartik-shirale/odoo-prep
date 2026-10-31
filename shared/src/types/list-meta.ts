/**
 * Pagination envelope metadata shared by every list endpoint.
 */

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
