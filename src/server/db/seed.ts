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

const starterMaps = [
  { slug:"drinking", title:"Everyday Drinks", description:"Đồ uống thường gặp trong ngày", root:"drinking", words:[
    ["hot drinks","đồ uống nóng","coffee","cà phê","I drink coffee after breakfast.","Tôi uống cà phê sau bữa sáng."],
    ["healthy choices","lựa chọn lành mạnh","herbal tea","trà thảo mộc","Herbal tea helps me relax.","Trà thảo mộc giúp tôi thư giãn."],
    ["cold drinks","đồ uống lạnh","sparkling water","nước có ga","Could I have sparkling water?","Cho tôi một chai nước có ga được không?"],
  ]},
  { slug:"home", title:"Home Essentials", description:"Từ vựng dùng trong nhà", root:"home", words:[
    ["rooms","các phòng","living room","phòng khách","We watch TV in the living room.","Chúng tôi xem TV trong phòng khách."],
    ["furniture","đồ nội thất","bookshelf","giá sách","The keys are on the bookshelf.","Chìa khóa ở trên giá sách."],
    ["housework","việc nhà","laundry basket","giỏ quần áo","Put the towels in the laundry basket.","Đặt khăn vào giỏ quần áo."],
  ]},
  { slug:"leisure", title:"Free Time Activities", description:"Hoạt động thư giãn thực tế", root:"leisure", words:[
    ["outdoors","ngoài trời","go hiking","đi bộ đường dài","We go hiking on Sunday.","Chúng tôi đi bộ đường dài vào Chủ nhật."],
    ["games","trò chơi","board game","trò chơi bàn cờ","Let's play a board game tonight.","Tối nay hãy chơi một trò chơi bàn cờ."],
    ["creative","sáng tạo","take photos","chụp ảnh","I like to take photos in the city.","Tôi thích chụp ảnh trong thành phố."],
  ]},
  { slug:"sports", title:"Sports Basics", description:"Từ vựng khi tập luyện và thi đấu", root:"sports", words:[
    ["training","luyện tập","warm up","khởi động","Always warm up before running.","Luôn khởi động trước khi chạy."],
    ["team","đội nhóm","teammate","đồng đội","My teammate passed me the ball.","Đồng đội chuyền bóng cho tôi."],
    ["match","trận đấu","score a goal","ghi bàn","She scored a goal in the final.","Cô ấy ghi bàn trong trận chung kết."],
  ]},
  { slug:"moods", title:"Feelings and Moods", description:"Diễn đạt cảm xúc tự nhiên", root:"moods", words:[
    ["calm","bình tĩnh","relaxed","thư giãn","I feel relaxed after a walk.","Tôi cảm thấy thư giãn sau khi đi bộ."],
    ["difficult","khó chịu","frustrated","bực bội","He felt frustrated with the delay.","Anh ấy bực bội vì sự chậm trễ."],
    ["positive","tích cực","cheerful","vui vẻ","She is cheerful this morning.","Sáng nay cô ấy rất vui vẻ."],
  ]},
  { slug:"transportation", title:"Getting Around", description:"Đi lại và phương tiện hằng ngày", root:"transportation", words:[
    ["public transport","giao thông công cộng","bus stop","trạm xe buýt","Wait for me at the bus stop.","Đợi tôi ở trạm xe buýt."],
    ["road","đường phố","traffic jam","kẹt xe","We were late because of a traffic jam.","Chúng tôi đến muộn vì kẹt xe."],
    ["directions","chỉ đường","get off","xuống xe","Get off at the next station.","Xuống xe ở ga tiếp theo."],
  ]},
  { slug:"body", title:"Body and Health", description:"Bộ phận cơ thể và triệu chứng cơ bản", root:"body", words:[
    ["upper body","thân trên","shoulder","vai","My shoulder hurts today.","Hôm nay vai tôi bị đau."],
    ["lower body","thân dưới","ankle","mắt cá chân","I twisted my ankle yesterday.","Hôm qua tôi bị trẹo mắt cá chân."],
    ["symptoms","triệu chứng","sore throat","đau họng","I have a sore throat.","Tôi bị đau họng."],
  ]},
  { slug:"holidays", title:"Holiday Moments", description:"Hoạt động trong ngày lễ", root:"holidays", words:[
    ["preparation","chuẩn bị","decorate","trang trí","We decorate the house together.","Chúng tôi cùng trang trí nhà."],
    ["traditions","truyền thống","exchange gifts","trao đổi quà","The children exchange gifts.","Bọn trẻ trao đổi quà."],
    ["calendar","lịch","public holiday","ngày nghỉ lễ","The office is closed on the public holiday.","Văn phòng đóng cửa vào ngày nghỉ lễ."],
  ]},
  { slug:"numbers", title:"Numbers in Real Life", description:"Số lượng và tỷ lệ thường dùng", root:"numbers", words:[
    ["quantity","số lượng","dozen","một tá","We bought a dozen eggs.","Chúng tôi mua một tá trứng."],
    ["fractions","phân số","half","một nửa","I ate half of the sandwich.","Tôi ăn một nửa chiếc bánh mì."],
    ["rates","tỷ lệ","percentage","phần trăm","The percentage increased this month.","Tỷ lệ phần trăm tăng trong tháng này."],
  ]},
  { slug:"love", title:"Healthy Relationships", description:"Giao tiếp trong các mối quan hệ", root:"love", words:[
    ["foundation","nền tảng","trust","tin tưởng","Trust takes time to build.","Niềm tin cần thời gian để xây dựng."],
    ["care","quan tâm","support each other","hỗ trợ lẫn nhau","We support each other at work.","Chúng tôi hỗ trợ lẫn nhau trong công việc."],
    ["connection","kết nối","get along","hòa hợp","I get along well with her family.","Tôi hòa hợp với gia đình cô ấy."],
  ]},
  { slug:"people", title:"People Around Us", description:"Mô tả những người thường gặp", root:"people", words:[
    ["community","cộng đồng","neighbor","hàng xóm","My neighbor is very friendly.","Hàng xóm của tôi rất thân thiện."],
    ["work","công việc","colleague","đồng nghiệp","I had lunch with a colleague.","Tôi ăn trưa với một đồng nghiệp."],
    ["unknown people","người lạ","stranger","người lạ","A stranger helped me find the station.","Một người lạ giúp tôi tìm nhà ga."],
  ]},
  { slug:"makeup", title:"Daily Make-up", description:"Đồ trang điểm và thao tác cơ bản", root:"makeup", words:[
    ["lips","môi","lipstick","son môi","This lipstick is too dark for me.","Màu son này quá đậm với tôi."],
    ["face","khuôn mặt","foundation","kem nền","Apply a thin layer of foundation.","Thoa một lớp kem nền mỏng."],
    ["routine","thói quen","remove makeup","tẩy trang","Remember to remove makeup before bed.","Nhớ tẩy trang trước khi ngủ."],
  ]},
  { slug:"animals", title:"Animals Around Us", description:"Thú cưng và động vật hoang dã", root:"animals", words:[
    ["young animals","động vật non","puppy","chó con","The puppy is sleeping under the chair.","Chó con đang ngủ dưới ghế."],
    ["wild animals","động vật hoang dã","wildlife","động vật hoang dã","We should protect local wildlife.","Chúng ta nên bảo vệ động vật hoang dã địa phương."],
    ["pet care","chăm sóc thú cưng","feed the cat","cho mèo ăn","Please feed the cat at six.","Hãy cho mèo ăn lúc sáu giờ."],
  ]},
  { slug:"nature", title:"Nature and Environment", description:"Cảnh quan và bảo vệ môi trường", root:"nature", words:[
    ["water","nước","waterfall","thác nước","The waterfall is beautiful after the rain.","Thác nước rất đẹp sau cơn mưa."],
    ["walking","đi bộ","forest trail","đường mòn trong rừng","We followed the forest trail.","Chúng tôi đi theo đường mòn trong rừng."],
    ["environment","môi trường","protect the environment","bảo vệ môi trường","Small actions protect the environment.","Những hành động nhỏ bảo vệ môi trường."],
  ]},
  { slug:"work", title:"Work and Study Essentials", description:"Công việc, học tập và tổ chức thời gian", root:"work", words:[
    ["planning","lập kế hoạch","deadline","hạn chót","The deadline is Friday afternoon.","Hạn chót là chiều thứ Sáu."],
    ["communication","giao tiếp","attend a meeting","tham dự cuộc họp","I attend a meeting every Monday.","Tôi tham dự cuộc họp mỗi thứ Hai."],
    ["learning","học tập","take notes","ghi chú","Take notes during the lesson.","Hãy ghi chú trong giờ học."],
  ]},
  { slug:"daily-life", title:"Daily Routine", description:"Những việc thường làm mỗi ngày", root:"daily-life", words:[
    ["morning","buổi sáng","wake up","thức dậy","I wake up at six thirty.","Tôi thức dậy lúc sáu giờ ba mươi."],
    ["tasks","công việc lặt vặt","run errands","chạy việc vặt","I need to run errands after work.","Tôi cần chạy vài việc vặt sau giờ làm."],
    ["home","ở nhà","tidy up","dọn dẹp","Let's tidy up the kitchen.","Hãy dọn dẹp nhà bếp."],
  ]},
] as const;

const learningPaths=[
  {slug:"a1",title:"A1 Beginner",level:"A1",description:"Sống sót cơ bản: giới thiệu, sinh hoạt, ăn uống, đi lại.",modules:[["introduce-yourself","Introduce Yourself","Giới thiệu bản thân bằng câu ngắn.","people"],["family-and-people","Family & People","Nói về người thân và người xung quanh.","people"],["daily-routine","Daily Routine","Kể lịch sinh hoạt hằng ngày.","daily-life"],["food-and-drinks","Food & Drinks","Gọi món và nói nhu cầu ăn uống đơn giản.","eating"],["home-and-objects","Home & Objects","Mô tả đồ vật và phòng trong nhà.","home"],["places-in-town","Places in Town","Hỏi và nói về địa điểm quen thuộc.","transportation"]]},
  {slug:"a2",title:"A2 Elementary",level:"A2",description:"Giao tiếp đời sống: quá khứ gần, kế hoạch, mua bán, sức khỏe.",modules:[["past-weekend","Past Weekend","Kể cuối tuần vừa rồi.","leisure"],["travel-and-directions","Travel & Directions","Hỏi đường và xử lý di chuyển.","transportation"],["health-and-body","Health & Body","Nói triệu chứng và cơ thể.","body"],["work-day","Work Day","Mô tả ngày làm việc/học tập.","work"],["plans-and-invitations","Plans & Invitations","Mời, hẹn, và nói kế hoạch.","daily-life"],["shopping-basics","Shopping Basics","Hỏi giá và lựa chọn cơ bản.","numbers"]]},
  {slug:"b1",title:"B1 Intermediate",level:"B1",description:"Dùng được trong công việc/cuộc sống: ý kiến, email, họp, vấn đề.",modules:[["job-interview","Job Interview","Tự giới thiệu trong phỏng vấn.","work"],["meetings","Meetings","Theo dõi và tham gia cuộc họp đơn giản.","work"],["email-basics","Email Basics","Viết email rõ và lịch sự.","work"],["giving-opinions","Giving Opinions","Nêu ý kiến và lý do.","moods"],["explaining-problems","Explaining Problems","Giải thích vấn đề và đề xuất cách xử lý.","daily-life"],["negotiation-basics","Negotiation Basics","Thương lượng nhẹ trong công việc.","work"]]},
  {slug:"b2",title:"B2 Upper-Intermediate",level:"B2",description:"Tự tin hơn: họp, trình bày, tranh luận nhẹ, đọc báo cáo.",modules:[["professional-email","Professional Email","Viết email công việc tự nhiên hơn.","work"],["meetings-and-decisions","Meetings & Decisions","Nói về quyết định trong họp.","work"],["presentations","Presentations","Trình bày ý tưởng có cấu trúc.","work"],["light-debate","Light Debate","Tranh luận nhẹ và giữ lịch sự.","moods"],["reading-reports","Reading Reports","Đọc báo cáo/ngữ cảnh dài hơn.","numbers"],["natural-conversation","Natural Conversation","Nói chuyện tự nhiên hơn.","people"]]},
] as const;

function seedLearningPaths(db:AppDatabase):void{
  const insertPath=db.prepare("INSERT OR IGNORE INTO learning_paths(slug,title,level,description,sort_order) VALUES (?,?,?,?,?)");
  const getPath=db.prepare("SELECT id FROM learning_paths WHERE slug=?");
  const insertModule=db.prepare("INSERT OR IGNORE INTO learning_modules(path_id,slug,title,goal_vi,cefr,topic_slug,sort_order) VALUES (?,?,?,?,?,?,?)");
  learningPaths.forEach((path,index)=>{insertPath.run(path.slug,path.title,path.level,path.description,index+1);const row=getPath.get(path.slug) as {id:number};path.modules.forEach((module,moduleIndex)=>insertModule.run(row.id,module[0],module[1],module[2],path.level,module[3],moduleIndex+1));});
}

function seedStarterMaps(db:AppDatabase):void{
  const findTopic=db.prepare("SELECT id,title_vi titleVi FROM topics WHERE slug=?");
  const findMap=db.prepare("SELECT id FROM mindmaps WHERE source='seed' AND title=?");
  const insertMap=db.prepare("INSERT INTO mindmaps(topic_id,title,description,status,source) VALUES (?,?,?,'approved','seed')");
  const insertNode=db.prepare("INSERT INTO mindmap_nodes(mindmap_id,parent_id,vocabulary_id,node_type,label,meaning_vi,ipa,color,position_x,position_y,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  const insertVocabulary=db.prepare("INSERT OR IGNORE INTO vocabulary(term,normalized_term,ipa,part_of_speech,meaning_vi,cefr) VALUES (?,?,?,?,?,?)");
  const getVocabulary=db.prepare("SELECT id FROM vocabulary WHERE normalized_term=?");
  const insertExample=db.prepare("INSERT INTO examples(vocabulary_id,sentence,translation_vi,situation) SELECT ?,?,?,'daily life' WHERE NOT EXISTS (SELECT 1 FROM examples WHERE vocabulary_id=? AND sentence=?)");
  const insertReview=db.prepare("INSERT OR IGNORE INTO review_cards(vocabulary_id) VALUES (?)");
  const colors=["coral","sky","leaf"] as const;
  const positions=[[300,-170],[340,80],[-280,120]] as const;
  for(const map of starterMaps){
    if(findMap.get(map.title))continue;
    const topic=findTopic.get(map.slug) as {id:number;titleVi:string};
    const mapId=Number(insertMap.run(topic.id,map.title,map.description).lastInsertRowid);
    const rootId=Number(insertNode.run(mapId,null,null,"root",map.root,topic.titleVi,"","amber",0,0,0).lastInsertRowid);
    map.words.forEach((word,index)=>{
      const [branchLabel,branchMeaning,term,meaning,sentence,translation]=word;
      const [x,y]=positions[index];
      const branchId=Number(insertNode.run(mapId,rootId,null,"branch",branchLabel,branchMeaning,"",colors[index],x,y,index+1).lastInsertRowid);
      const normalized=term.toLowerCase();
      insertVocabulary.run(term,normalized,"",term.includes(" ")?"phrase":"noun",meaning,"A2");
      const vocabulary=getVocabulary.get(normalized) as {id:number};
      insertExample.run(vocabulary.id,sentence,translation,vocabulary.id,sentence);
      insertReview.run(vocabulary.id);
      insertNode.run(mapId,branchId,vocabulary.id,"vocabulary",term,meaning,"",colors[index],x+(index===2?-150:150),y+80,0);
    });
  }
}
export function seedDatabase(db: AppDatabase): void {
  withTransaction(db, () => {
    const insertTopic = db.prepare(`INSERT OR IGNORE INTO topics(slug,title,title_vi,icon,color,sort_order) VALUES (?,?,?,?,?,?)`);
    topics.forEach((topic, index) => insertTopic.run(...topic, index + 1));

    const existing = db.prepare("SELECT id FROM mindmaps WHERE source = 'seed' AND title = ?").get("Eating Essentials") as { id: number } | undefined;
    if (existing) { seedStarterMaps(db); seedLearningPaths(db); return; }

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
    seedStarterMaps(db);
    seedLearningPaths(db);
  });
}

