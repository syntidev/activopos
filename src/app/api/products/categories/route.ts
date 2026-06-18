// Thin alias — the categories endpoint lives at /api/categories.
// The products page fetches /api/products/categories, so we re-export
// the same handlers here without duplicating logic.
export { GET, POST } from '@/app/api/categories/route'
