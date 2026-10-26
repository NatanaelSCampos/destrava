import test from "node:test";
import assert from "node:assert/strict";
import { courseInteractiveLesson, courseLessonPath, resolveCourseLesson } from "../src/lib/course-lesson-navigation.ts";

function fixture() {
  return { slug:"synthetic-course", units:[{ id:"unit-a", number:1, slug:"first-unit", active:true,
    lessons:[{id:"lesson-a",slug:"first-lesson",active:true,interactiveLessonRef:"guided-a"},
      {id:"lesson-b",slug:"second-lesson",active:true,interactiveLessonRef:"guided-b"}]}] };
}
const definitions=[{id:"guided-a",lessonId:"lesson-a"},{id:"guided-b",lessonId:"lesson-b"}];
const location={courseSlug:"synthetic-course",unitSlug:"1",lessonSlug:"first-lesson"};
test("course links keep the lesson path and encode authored slugs",()=>{
  assert.equal(courseLessonPath({slug:"course/x"},{number:2},{slug:"lesson ?"}),"/course/course%2Fx/unit/2/lesson/lesson%20%3F");
});
test("the same exact lesson resolves using unit number or unit slug",()=>{
  for(const unitSlug of["1","first-unit"])assert.equal(courseInteractiveLesson(fixture(),definitions,{...location,unitSlug}).definition.id,"guided-a");
});
for(const [label,mutation] of [
  ["foreign course",(c,l)=>{l.courseSlug="other-course";}],
  ["foreign unit",(c,l)=>{l.unitSlug="2";}],
  ["unknown lesson",(c,l)=>{l.lessonSlug="missing";}],
  ["inactive unit",c=>{c.units[0].active=false;}],
  ["inactive lesson",c=>{c.units[0].lessons[0].active=false;}],
  ["unavailable unit",c=>{c.availability={unavailableUnitIds:["unit-a"]};}],
  ["unavailable exact definition",c=>{c.availability={unavailableInteractiveLessonIds:["guided-a"]};}],
  ["another lesson's valid definition",c=>{c.units[0].lessons[0].interactiveLessonRef="guided-b";}],
  ["missing reference",c=>{delete c.units[0].lessons[0].interactiveLessonRef;}],
  ["unknown reference",c=>{c.units[0].lessons[0].interactiveLessonRef="unknown-guided";}],
])test(label+" never falls back to a different guided lesson",()=>{
  const course=fixture(),where={...location};mutation(course,where);assert.equal(courseInteractiveLesson(course,definitions,where),undefined);
});
test("ordinary lessons still resolve without pretending to be guided lessons",()=>{
  const course=fixture();delete course.units[0].lessons[0].interactiveLessonRef;
  assert.equal(resolveCourseLesson(course,location).lesson.id,"lesson-a");assert.equal(courseInteractiveLesson(course,definitions,location),undefined);
});
test("a definition whose id matches but whose lesson does not match is refused",()=>{
  assert.equal(courseInteractiveLesson(fixture(),[{id:"guided-a",lessonId:"elsewhere"}],location),undefined);
});
