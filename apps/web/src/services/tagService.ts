/**
 * ============================================
 *  tagService.ts — Tag API Service Layer
 * ============================================
 *
 * The `tags` collection stores the relation to lectures
 * on its own side (`tags.lectures` is a multiple relation),
 * so "tagging a lecture" means updating the tag records.
 */

import { pb } from "../lib/pocketbase";
import type { Tag } from "../lib/types";
import { FIELDS, tagLectureIds } from "../lib/types";

/**
 * Fetch all tags, sorted by name.
 */
export async function fetchTags(): Promise<Tag[]> {
  return pb.collection("tags").getFullList<Tag>({
    sort: FIELDS.tagName,
  });
}

/**
 * Create a new tag.
 *
 * @param name  — tag label
 * @param color — HEX color (e.g. "#5ACF65")
 * @returns The created Tag record.
 */
export async function createTag(name: string, color: string): Promise<Tag> {
  return pb.collection("tags").create<Tag>({
    [FIELDS.tagName]: name.trim(),
    [FIELDS.tagColor]: color,
  });
}

/**
 * Rewrite the list of lectures a tag belongs to.
 *
 * @param tagId      — PocketBase record ID of the tag
 * @param lectureIds — full list of lecture IDs for this tag
 * @returns The updated Tag record.
 */
export async function updateTagLectures(
  tagId: string,
  lectureIds: string[]
): Promise<Tag> {
  return pb.collection("tags").update<Tag>(tagId, {
    [FIELDS.tagLectures]: lectureIds,
  });
}

/**
 * Apply the wanted tag set to a lecture.
 *
 * The relation lives on the tags side, so we diff each tag's
 * `lectures` array and only touch the tags that actually changed.
 *
 * @param lectureId — PocketBase record ID of the lecture
 * @param tagIds    — tag ids that should reference this lecture
 */
export async function applyLectureTags(
  lectureId: string,
  tagIds: string[]
): Promise<void> {
  const all = await fetchTags();
  const wanted = new Set(tagIds);
  const changed = all.filter(
    (t) => tagLectureIds(t).includes(lectureId) !== wanted.has(t.id)
  );
  await Promise.all(
    changed.map((t) => {
      const ids = new Set(tagLectureIds(t));
      if (wanted.has(t.id)) {
        ids.add(lectureId);
      } else {
        ids.delete(lectureId);
      }
      return updateTagLectures(t.id, [...ids]);
    })
  );
}
