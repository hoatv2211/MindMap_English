import type { AppDatabase } from "./database";
import { withTransaction } from "./database";

const topics = [
  ["eating", "Eating", "Ăn uống", "utensils", "coral"],
  ["drinking", "Drinking", "Đồ uống", "cup-soda", "sky"],
  ["home", "Home", "Nhà cửa", "house", "amber"],
  ["leisure", "Leisure Time", "Thời gian rảnh", "ticket", "violet"],
  ["sports", "Sports", "Thể thao", "dumbbell", "leaf"],
  ["moods", "Moods", "Tâm trạng", "smile", "coral"],
  ["transportation", "Transportation", "Phương tiện", "bus", "sky"],
  ["body", "Body Parts", "Bộ phận cơ thể", "accessibility", "amber"],
  ["holidays", "Happy Holidays", "Ngày lễ", "gift", "coral"],
  ["numbers", "About Numbers", "Số đếm", "binary", "sky"],
  ["love", "Love", "Tình yêu", "heart", "coral"],
  ["people", "About People", "Con người", "users", "violet"],
  ["makeup", "Make-up", "Trang điểm", "sparkles", "amber"],
  ["animals", "Animal Kingdom", "Động vật", "paw-print", "leaf"],
  ["nature", "Nature", "Thiên nhiên", "trees", "leaf"],
  ["work", "Work & Study", "Công việc & học tập", "briefcase", "sky"],
  ["daily-life", "Daily Life", "Đời sống hằng ngày", "sun", "amber"],
] as const;

const eatingGroups = [
  { label: "fruit", meaning: "trái cây", color: "coral", x: 230, y: -180, words: [
    ["apple", "/ˈæp.əl/", "quả táo", "A1", "I usually have an apple after lunch.", "Tôi thường ăn một quả táo sau bữa trưa."],
    ["orange", "/ˈɒr.ɪndʒ/", "quả cam", "A1", "Would you like some fresh orange juice?", "Bạn có muốn uống nước cam tươi không?"],
    ["ripe", "/raɪp/", "chín", "B1", "These bananas are ripe and ready to eat.", "Những quả chuối này đã chín và có thể ăn được."],
  ]},
  { label: "vegetables", meaning: "rau củ", color: "leaf", x: 390, y: 40, words: [
    ["lettuce", "/ˈlet.ɪs/", "rau xà lách", "A2", "Add some lettuce to the sandwich.", "Thêm một ít rau xà lách vào bánh mì."],
    ["cabbage", "/ˈkæb.ɪdʒ/", "bắp cải", "A2", "She made cabbage soup for dinner.", "Cô ấy nấu súp bắp cải cho bữa tối."],
    ["leafy greens", "/ˌliː.fi ˈɡriːnz/", "rau lá xanh", "B1", "Leafy greens are rich in vitamins.", "Rau lá xanh giàu vitamin."],
  ]},
  { label: "meat", meaning: "thịt", color: "amber", x: 260, y: 230, words: [
    ["beef", "/biːf/", "thịt bò", "A2", "I ordered beef noodles for lunch.", "Tôi gọi mì bò cho bữa trưa."],
    ["pork", "/pɔːk/", "thịt heo", "A2", "This dish is made with pork and herbs.", "Món này được làm từ thịt heo và rau thơm."],
    ["lean meat", "/ˌliːn ˈmiːt/", "thịt nạc", "B1", "Lean meat is a useful source of protein.", "Thịt nạc là nguồn protein hữu ích."],
  ]},
  { label: "seafood", meaning: "hải sản", color: "sky", x: -250, y: 230, words: [
    ["shrimp", "/ʃrɪmp/", "tôm", "A2", "The fried rice comes with shrimp.", "Cơm chiên có kèm tôm."],
    ["shellfish", "/ˈʃel.fɪʃ/", "động vật có vỏ", "B1", "Tell the waiter if you are allergic to shellfish.", "Hãy báo người phục vụ nếu bạn dị ứng động vật có vỏ."],
    ["fresh catch", "/ˌfreʃ ˈkætʃ/", "hải sản mới đánh bắt", "B2", "The restaurant serves the fresh catch of the day.", "Nhà hàng phục vụ hải sản mới đánh bắt trong ngày."],
  ]},
  { label: "dessert", meaning: "món tráng miệng", color: "violet", x: -390, y: 20, words: [
    ["doughnut", "/ˈdəʊ.nʌt/", "bánh vòng", "A2", "We shared a doughnut with our coffee.", "Chúng tôi chia nhau một chiếc bánh vòng cùng cà phê."],
    ["sweet tooth", "/ˌswiːt ˈtuːθ/", "hảo ngọt", "B1", "I have a sweet tooth, so I love this bakery.", "Tôi hảo ngọt nên rất thích tiệm bánh này."],
    ["treat", "/triːt/", "món ăn thưởng", "B1", "Ice cream is an occasional treat for me.", "Kem là món tôi thỉnh thoảng tự thưởng."],
  ]},
  { label: "snacks", meaning: "đồ ăn nhẹ", color: "coral", x: -230, y: -180, words: [
    ["snack", "/snæk/", "đồ ăn nhẹ", "A1", "I keep a healthy snack in my bag.", "Tôi để một món ăn nhẹ lành mạnh trong túi."],
    ["junk food", "/ˈdʒʌŋk ˌfuːd/", "đồ ăn không lành mạnh", "B1", "I am trying to cut down on junk food.", "Tôi đang cố giảm đồ ăn không lành mạnh."],
    ["grab a bite", "/ˌɡræb ə ˈbaɪt/", "ăn nhanh một chút", "B1", "Let's grab a bite before the movie.", "Hãy ăn nhanh một chút trước khi xem phim."],
  ]},
] as const;

export function seedDatabase(db: AppDatabase): void {
  withTransaction(db, () => {
    const insertTopic = db.prepare(`INSERT OR IGNORE INTO topics(slug,title,title_vi,icon,color,sort_order) VALUES (?,?,?,?,?,?)`);
    topics.forEach((topic, index) => insertTopic.run(...topic, index + 1));

    const existing = db.prepare("SELECT id FROM mindmaps WHERE source = 'seed' AND title = ?").get("Eating Essentials") as { id: number } | undefined;
    if (existing) return;

    const topic = db.prepare("SELECT id FROM topics WHERE slug = 'eating'").get() as { id: number };
    const mapId = Number(db.prepare(`INSERT INTO mindmaps(topic_id,title,description,status,source) VALUES (?,?,?,?,?)`).run(topic.id, "Eating Essentials", "Từ vựng ăn uống thực dụng từ A1 đến B1", "approved", "seed").lastInsertRowid);
    const insertNode = db.prepare(`INSERT INTO mindmap_nodes(mindmap_id,parent_id,vocabulary_id,node_type,label,meaning_vi,ipa,color,position_x,position_y,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const rootId = Number(insertNode.run(mapId, null, null, "root", "eating", "ăn uống", "/ˈiː.tɪŋ/", "amber", 0, 0, 0).lastInsertRowid);
    const insertVocabulary = db.prepare(`INSERT OR IGNORE INTO vocabulary(term,normalized_term,ipa,part_of_speech,meaning_vi,cefr) VALUES (?,?,?,?,?,?)`);
    const getVocabulary = db.prepare("SELECT id FROM vocabulary WHERE normalized_term = ?");
    const insertExample = db.prepare(`INSERT INTO examples(vocabulary_id,sentence,translation_vi,situation) VALUES (?,?,?,?)`);
    const insertReview = db.prepare("INSERT OR IGNORE INTO review_cards(vocabulary_id) VALUES (?)");

    let order = 1;
    for (const group of eatingGroups) {
      const branchId = Number(insertNode.run(mapId, rootId, null, "branch", group.label, group.meaning, "", group.color, group.x, group.y, order++).lastInsertRowid);
      let wordIndex = 0;
      for (const word of group.words) {
        const [term, ipa, meaning, cefr, sentence, translation] = word;
        const normalized = term.toLowerCase();
        insertVocabulary.run(term, normalized, ipa, term.includes(" ") ? "phrase" : "noun", meaning, cefr);
        const vocabulary = getVocabulary.get(normalized) as { id: number };
        insertExample.run(vocabulary.id, sentence, translation, "daily life");
        insertReview.run(vocabulary.id);
        const angle = (wordIndex - 1) * 0.55;
        insertNode.run(mapId, branchId, vocabulary.id, "vocabulary", term, meaning, ipa, group.color, group.x + Math.cos(angle) * 180, group.y + Math.sin(angle) * 180, wordIndex);
        wordIndex += 1;
      }
    }
  });
}

