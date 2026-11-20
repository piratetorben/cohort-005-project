import { describe, expect, it } from "vitest";
import { flattenCourseLessons } from "../course.server";

describe("flattenCourseLessons", () => {
  it("lists every lesson in module order, tagged with its module", () => {
    const flat = flattenCourseLessons({
      modules: [
        {
          id: 10,
          title: "Basics",
          lessons: [
            { id: 1, title: "Intro", moduleId: 10 },
            { id: 2, title: "Setup", moduleId: 10 },
          ],
        },
        {
          id: 20,
          title: "Types",
          lessons: [{ id: 3, title: "Unions", moduleId: 20 }],
        },
      ],
    });

    expect(flat).toEqual([
      { id: 1, title: "Intro", moduleId: 10, moduleTitle: "Basics" },
      { id: 2, title: "Setup", moduleId: 10, moduleTitle: "Basics" },
      { id: 3, title: "Unions", moduleId: 20, moduleTitle: "Types" },
    ]);
  });

  it("is empty for a course with no modules", () => {
    expect(flattenCourseLessons({ modules: [] })).toEqual([]);
  });
});
