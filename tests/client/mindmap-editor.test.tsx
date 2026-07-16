// @vitest-environment jsdom
import {render,screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe,expect,it,vi} from "vitest";
import {MindmapEditorPanel} from "../../src/client/components/MindmapEditorPanel";

const node={id:2,parentId:1,vocabularyId:null,nodeType:"branch" as const,label:"communication",meaningVi:"giao tiếp",ipa:"",color:"sky" as const,x:1,y:2,status:"new" as const,imageUrl:null};
describe("MindmapEditorPanel",()=>{
 it("edits selected node and starts AI vocabulary capture",async()=>{
  const save=vi.fn();const add=vi.fn();const user=userEvent.setup();
  render(<MindmapEditorPanel node={node} onSave={save} onAddWord={add} onClose={vi.fn()}/>);
  const label=screen.getByLabelText("Tên node");await user.clear(label);await user.type(label,"meetings");await user.click(screen.getByRole("button",{name:"Lưu thay đổi"}));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({label:"meetings"}));
  await user.click(screen.getByRole("button",{name:"Thêm từ với AI"}));
  await user.type(screen.getByLabelText("Từ hoặc cụm từ"),"negotiate");await user.click(screen.getByRole("button",{name:"Tạo nháp AI"}));
  expect(add).toHaveBeenCalledWith("negotiate","");
 });
 it("starts image generation for vocabulary nodes",async()=>{
  const vocab={...node,nodeType:"vocabulary" as const,vocabularyId:9,label:"apple",meaningVi:"quả táo",imageUrl:null};
  const createImage=vi.fn();const user=userEvent.setup();
  render(<MindmapEditorPanel node={vocab} onSave={vi.fn()} onAddWord={vi.fn()} onCreateImage={createImage} onClose={vi.fn()}/>);
  expect(screen.getByText("Chưa có ảnh minh họa")).toBeInTheDocument();
  await user.click(screen.getByRole("button",{name:"Tạo ảnh minh họa"}));
  expect(createImage).toHaveBeenCalledWith(2);
 });
});