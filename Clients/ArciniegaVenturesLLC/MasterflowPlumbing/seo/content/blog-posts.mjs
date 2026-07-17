import { DRAIN_AND_SEWER_POSTS } from "./blog-drains.mjs";
import { REPIPING_POSTS } from "./blog-repiping.mjs";
import { LEAKS_AND_WATER_HEATER_POSTS } from "./blog-leaks-water.mjs";
import { EMERGENCY_AND_COMMERCIAL_POSTS } from "./blog-emergency-commercial.mjs";

export const BLOG_POSTS = [
  ...DRAIN_AND_SEWER_POSTS,
  ...REPIPING_POSTS,
  ...LEAKS_AND_WATER_HEATER_POSTS,
  ...EMERGENCY_AND_COMMERCIAL_POSTS,
];

const slugs = BLOG_POSTS.map((post) => post.slug);
const duplicateSlugs = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);

if (BLOG_POSTS.length !== 45) {
  throw new Error(`Expected 45 Masterflow blog posts, found ${BLOG_POSTS.length}.`);
}

if (duplicateSlugs.length) {
  throw new Error(`Duplicate Masterflow blog slugs: ${[...new Set(duplicateSlugs)].join(", ")}`);
}

for (const post of BLOG_POSTS) {
  if (!post.title || !post.description || !post.category || !post.lede || !post.sections?.length) {
    throw new Error(`Incomplete Masterflow blog post source: ${post.slug}`);
  }
}
