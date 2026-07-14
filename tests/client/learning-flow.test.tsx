// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuizCard } from "../../src/client/components/QuizCard";

const item={id:1,vocabularyId:1,activityType:"meaning-recall",sortOrder:0,isNew:1,term:"apple",meaningVi:"quả táo",ipa:"/ˈæp.əl/",cefr:"A1",status:"new",example:"I eat an apple.",exampleVi:"Tôi ăn một quả táo."};
describe("QuizCard",()=>{it("reveals answer and records an explicit SRS grade",async()=>{const onGrade=vi.fn();render(<QuizCard item={item} onGrade={onGrade} onSpeak={vi.fn()}/>);await userEvent.type(screen.getByPlaceholderText("Nhập từ hoặc nghĩa..."),"apple");await userEvent.click(screen.getByText("Kiểm tra"));expect(screen.getByText("I eat an apple.")).toBeInTheDocument();await userEvent.click(screen.getByText("Tốt"));expect(onGrade).toHaveBeenCalledWith(expect.objectContaining({answer:"apple",isCorrect:true,grade:"good"}))})});
