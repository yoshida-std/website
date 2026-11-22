// ステージの データ(ユーザー指示 2026-11-22: ステージ・てきを これから ふやしていく)
// ステージを ふやすときは STAGES に 1つ たす。てきの しゅるいを ふやすときは ENEMY_KINDS に たす(下の メモ)
//
// ステージの 項目:
//   id        … ほぞん・URL(?stage=)・ボットで つかう なまえ(英数字)
//   name/desc … ステージ選択の 画面に 出す 名前と 説明(ひらがな中心)
//   enemies   … てきの 一覧。{kind:てきの しゅるい(ENEMY_KINDS の キー), x, z}。ならびの じゅんが A,B,C,D…(ひだり→みぎ)
//   lock      … さいしょに ロックする てきの ばんごう(0 はじまり)
//   introStart… スタート演出で てきが おちはじめる 時間(秒)。てきの 数と おなじ 長さ
// 土俵の 大きさ・勇者/まほうつかいの いちは 今は ぜんぶ おなじ(CFG.arena・logic.js の init)。ステージごとに かえたいときは、ここに arena などを たして init で よむ
//
// てきの しゅるい(ENEMY_KINDS): いまは「どすこいオーガ」だけ。ステータスは config.js の ET(おもさで かわる。ボタンで きりかえ)。
//   あたらしい てきを たすときは、ここに すきな ステータス(w hp speed r color color2 name)を かき、
//   見た目は render2d.js の *Parts と three-chars.js に たす(スキル tatakae-character-design を つかう)。
//   ※ いまは どの てきも enemyParts で えがく(e.kind で モデルを えらぶ 仕組みは まだ ない)
export const ENEMY_KINDS={
  ogre:{name:'どすこいオーガ',spec:'ET'}   // 'ET' = config.js の ET(おもさ 70/100/160 で ステータスが かわる)
};

export const STAGES=[
  {id:'ogre4',name:'どすこいオーガ ×4',
   desc:'4ひきの どすこいオーガが どひょうに ふってくる。まほうつかいを まもりながら ぜんぶ たおせ！',
   enemies:[{kind:'ogre',x:-6,z:16.5},{kind:'ogre',x:-2,z:19.5},{kind:'ogre',x:2,z:19.5},{kind:'ogre',x:6,z:16.5}],
   lock:1,
   introStart:[0.25,1.0,1.4,1.8]}
];
export const stageById=id=>STAGES.find(s=>s.id===id)||STAGES[0];
