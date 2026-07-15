// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VocabularyInboxPage } from "../../src/client/pages/VocabularyInboxPage";
import { api } from "../../src/client/api/client";

const item={id:7,userId:1,rawText:"negotiate",normalizedText:"negotiate",contextText:"work",sourceType:"quick_capture",sourceReference:"",hintMindmapId:null,hintParentNodeId:null,status:"ready",errorMessage:null,approvedVocabularyId:null,approvedMindmapId:null,createdAt:"",updatedAt:"",approvedAt:null,draft:{normalizedTerm:"negotiate",displayTerm:"negotiate",meaningVi:"??m ph?n",ipa:"",partOfSpeech:"verb",cefr:"B1",itemType:"word",examples:[{role:"basic",sentence:"We negotiate.",translationVi:"Ch?ng ta ??m ph?n.",usageNote:""},{role:"daily_life",sentence:"Can we negotiate?",translationVi:"Ta th\u01b0\u01a1ng l\u01b0\u1ee3ng ???c kh?ng?",usageNote:""},{role:"personalized",sentence:"I negotiate deadlines.",translationVi:"T?i ??m ph?n th?i h?n.",usageNote:""}],placement:{mindmapId:null,parentNodeId:null,reason:"",newMindmap:{title:"Negotiation",description:"",branchLabel:"Core"}}}};
vi.mock("../../src/client/api/client",async(importOriginal)=>{const original=await importOriginal<typeof import("../../src/client/api/client")>();return{...original,api:{...original.api,vocabularyInbox:vi.fn(),updateVocabularyDraft:vi.fn(),approveVocabulary:vi.fn(),retryVocabularyEnrichment:vi.fn(),dismissVocabulary:vi.fn()}}});
afterEach(cleanup);beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.vocabularyInbox).mockResolvedValue([item] as never);vi.mocked(api.updateVocabularyDraft).mockResolvedValue(item as never);vi.mocked(api.approveVocabulary).mockResolvedValue({vocabularyId:3,mindmapId:4})});
describe("VocabularyInboxPage",()=>{it("reviews edits and approves exactly three examples",async()=>{render(<VocabularyInboxPage/>);expect((await screen.findAllByText("negotiate")).length).toBeGreaterThan(0);expect(screen.getAllByTestId("example-card")).toHaveLength(3);const user=userEvent.setup();const meaning=screen.getByLabelText("Ngh\u0129a ti\u1ebfng Vi\u1ec7t");await user.clear(meaning);await user.type(meaning,"th\u01b0\u01a1ng l\u01b0\u1ee3ng");await user.click(screen.getByRole("button",{name:"Duy\u1ec7t v\u00e0 \u0111\u01b0a v\u00e0o \u00f4n t\u1eadp"}));expect(api.updateVocabularyDraft).toHaveBeenCalled();expect(api.approveVocabulary).toHaveBeenCalledWith(7,{});});
it("moves a successful retry to the ready tab",async()=>{
  const failed={...item,status:"failed",errorMessage:"AI enrichment unavailable",draft:null};
  vi.mocked(api.vocabularyInbox).mockImplementation(async(status)=>status==="failed"?[failed] as never:status==="ready"?[item] as never:[] as never);
  vi.mocked(api.retryVocabularyEnrichment).mockResolvedValue(item as never);
  render(<VocabularyInboxPage initialStatus="failed"/>);
  const user=userEvent.setup();
  await user.click(await screen.findByRole("button",{name:"Th\u1eed AI l\u1ea1i"}));
  expect(api.vocabularyInbox).toHaveBeenLastCalledWith("ready");
  expect(screen.getByRole("button",{name:"Ch\u1edd duy\u1ec7t"})).toHaveClass("active");
});});
