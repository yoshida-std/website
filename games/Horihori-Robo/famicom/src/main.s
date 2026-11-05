; ホリホリ・ロボバスター ファミコン版
; 第4段階: 縦長の迷路(31行)を強制スクロールで下から上へ。画面に出る行だけ背景に書く。
.setcpu "6502"

; 文字の表 tab を cnt 個、(xx, yy) から横に並べる(OAMは to から続けて使う)
.macro LINE tab, cnt, xx, yy
    lda #<tab
    sta tp
    lda #>tab
    sta tp+1
    lda #cnt
    sta tn
    lda #xx
    sta cx
    lda #yy
    sta cy
    jsr draw_text
.endmacro

ROWS      = 31          ; 迷路の行数(1行=16px)
START_CAM = 288         ; 開始時のカメラ(世界座標で迷路窓の一番上のy) = 31*16-208
HUDBLANK  = 20          ; 表示帯の背景タイル: 黒
HUDD0     = 22          ; 数字0のタイル(白)
HUDV0     = 117         ; 表示帯の値の数字0(黄)。117〜126
HUDHEAD   = 127         ; 残機の絵(黄色いロボの頭)
HUDLAD    = 128         ; ハシゴの残りの絵
HUD_H     = 32          ; 画面上部の表示帯の高さ(px)。迷路はその下の208px
NROBMAX   = 5           ; 白いロボの最大数(ステージ5で5体)。番号5は赤いロボ
STAGES    = 5
TURN_FR   = 8           ; 止まっているときに方向キーを押すと、まずその向きに変わり、このフレーム数だけ押し続けると歩き出す
SCROLL_WAIT = 300       ; ゲーム開始(STAGE x の表示が終わったあと)からスクロールが始まるまで(フレーム=5秒)
INTRO_FR  = 180         ; ステージ開始時の「STAGE x」を出すフレーム数(3秒)
TRAP_T    = 105         ; 穴から這い出るまで(2フレーム単位 ≒ 3.5秒)
INVINC    = 150         ; ミス後の無敵(フレーム)
HOLE_T    = 165         ; 穴がふさがるまで(2フレーム単位 = 約5.5秒)
HOLE_SMALL= 45          ; この残りで小さくなる
.ifndef LIVES0
LIVES0    = 3           ; 最初の残機(ミスは3回まで)
.endif
PAUSE_FR  = 120         ; 復活後にスクロールが止まるフレーム数(2秒)

.segment "HEADER"
    .byte "NES", $1A
    .byte 2             ; PRG 16KB x2
    .byte 1             ; CHR 8KB x1
    .byte 3, 0, 1       ; 縦ミラー(迷路=画面A、表示帯=画面B)+電池つきRAM、マッパー0、PRG-RAM 8KB(ハイスコア)

.segment "ZEROPAGE"
pad:    .res 1
px:     .res 1
pylo:   .res 1          ; 世界座標y(16bit)
pyhi:   .res 1
dir:    .res 1          ; 0=下 1=上 2=横
flip:   .res 1          ; 1=左向き(横反転)
anim:   .res 1
atimer: .res 1
nmiflag:.res 1
mdir:   .res 1          ; 移動中の向き(1=右 2=左 4=下 8=上、0=止まり)。パッドのビットと同じ
sd:     .res 1
camlo:  .res 1          ; カメラ(世界座標で画面の一番上のy、16bit)
camhi:  .res 1
camf:   .res 1          ; 小数部(1/256px)
ltop:   .res 1          ; 背景に書き込み済みの一番上のマス行
pending:.res 1          ; 1=NMIで rowbuf を背景に書く
scrl:   .res 1          ; スクロールY(PPU)
ctrl:   .res 1          ; $2000 の値(下位のネームテーブル選択を含む)
ptr:    .res 2
wrlo:   .res 1
wrhi:   .res 1
rr:     .res 1
; draw_char の引数
cx:     .res 1
cy:     .res 1
cfr:    .res 1
cfl:    .res 1
cat:    .res 1
tb:     .res 1
t0:     .res 1
t1:     .res 1
t2:     .res 1
t3:     .res 1
at:     .res 1
tmp:    .res 1
bx0:    .res 1
bx1:    .res 1
cya:    .res 1
cyb:    .res 1
u:      .res 1
v:      .res 1
lives:  .res 1
gover:  .res 1          ; 1=ゲームオーバー
campause:.res 1         ; >0 の間はスクロールを止める(復活直後)
rng:    .res 2          ; 乱数(16bit LFSR)
seed:   .res 2          ; Startを押すまでのフレーム数 = 乱数の種
title:  .res 1          ; 1=タイトル画面
md:     .res 1          ; 剰余の割る数
ssz:    .res 1          ; 迷路生成のスタックの数
cur:    .res 1
gx:     .res 1
gy:     .res 1
nx:     .res 1
ny:     .res 1
ncand:  .res 1
tp:     .res 2          ; draw_text の文字表
tn:     .res 1
invinc: .res 1
chalf:  .res 1          ; 1=上半分だけ描く(穴にはまったロボ)
rc:     .res 1          ; 処理中のロボの番号
epoch:  .res 1          ; 距離マップの世代($00/$80)
bfs_on: .res 1
bqh:    .res 1
bqt:    .res 1
btop:   .res 1          ; 距離マップが覆う一番上のマス行(16行分)
bc:     .res 1
bd:     .res 1
kk:     .res 1
dg:     .res 5          ; スコア(10000,1000,100,10,1の位)
stage:  .res 1          ; 1〜5
clear:  .res 1          ; 1=ステージクリア(Start待ち)
camspd: .res 1          ; このステージの変数(表から)
rspd:   .res 1
rrsp:   .res 1
nrob:   .res 1
nrobm1: .res 1
golds:  .res 1          ; 取った金塊の数
bestrow:.res 1          ; いちばん上まで進んだマス行(上がるたび+10点)
ladders:.res 1          ; 残りのハシゴ
pushtimer:.res 1        ; 壁に向かって止まってから、ハシゴをかけられる残り時間
swcx:   .res 1          ; ストップウォッチのマス
swcy:   .res 1
swon:   .res 1
freezes:.res 1          ; スクロールが止まっている残り秒
freezef:.res 1
rspr:   .res 1          ; 赤いロボの速さ
redsp:  .res 1          ; 1=赤いロボは出た
soff:   .res 1          ; 出現位置: 画面の上端からの行数
bgm_on: .res 1          ; 1=BGMを鳴らす
m1p:    .res 2          ; BGM 矩形波1(メロディ)の読み出し位置・残りフレーム・経過・音
m1c:    .res 1
m1t:    .res 1
m1n:    .res 1
m2p:    .res 2          ; BGM 三角波(ベース)
m2c:    .res 1
m2n:    .res 1
spp:    .res 2          ; 効果音(矩形波2)の曲
spc:    .res 1
spt:    .res 1
spn:    .res 1
spon:   .res 1
snc:    .res 1          ; 効果音(ノイズ)の残りフレーム・音量
snv:    .res 1
sfx_req:.res 1          ; 鳴らしたい効果音の番号(NMIが受け取って0に戻す)
hudflag:.res 1          ; 1=表示帯の数字を書き直す
sp2:    .res 1          ; 画面途中のスクロール切り替えに使う値
face:   .res 1          ; 向いている方向(1=右 2=左 4=下 8=上)
digbuf: .res 1          ; 掘るボタンの入力をためておく(フレーム)
digheld:.res 1
ladbuf: .res 1          ; Bボタン(ハシゴ)の入力をためておく
ladheld:.res 1
hstate: .res 1          ; 0=ふつう 1=穴に落ちて動けない 2=這い出た直後(この穴では落ちない)
fallt:  .res 1
fc:     .res 1
hidx:   .res 1
hidx2:  .res 1
dcx:    .res 1
dcy:    .res 1
qhead:  .res 1
qtail:  .res 1
qn:     .res 1
to:     .res 1          ; draw_text の書き込み先(OAMのオフセット)

.segment "OAM"
oam:    .res 256

.segment "BSS"
tcam:   .res 1          ; タイトルの絵の上端(世界座標。208から0へ。絵が降りてくる)
tprev:  .res 1
hsr:    .res 5          ; ハイスコア(10000,1000,100,10,1の位)
padold: .res 1          ; 前のフレームのボタン
padnew: .res 1          ; このフレームに押したボタン
paused: .res 1          ; 1=ポーズ中
pmenu:  .res 1          ; ポーズ画面の選んでいる項目(0〜2)
bgmwas: .res 1          ; ポーズに入る前の bgm_on
sdelay: .res 2          ; 開始からスクロールが始まるまでの残りフレーム
intro:  .res 1          ; >0 の間は「STAGE x」を出して止まっている(残りフレーム)
cscr:   .res 1          ; 1=黒いクリア画面を出している
cblink: .res 1          ; PUSH START の点滅用カウンタ
pcol:   .res 1          ; 点滅する色(背景パレット2の色2)
bon:    .res 1          ; クリアボーナス(100点単位)
tgold:  .res 1          ; 通しで取った金塊の数
healed: .res 1          ; 1=クリアで残機が回復する
tbuf:   .res 8          ; 文字の表(実行時に作るもの)
hudbuf: .res 16         ; 表示帯の数字のタイル(スコア5・残機・ストップウォッチ2・ステージ・金塊2・ハシゴ)
rowbuf: .res 32         ; 背景1マス行の上のタイル行
rowbuf2:.res 32         ; 同じ、下のタイル行
mapram: .res 512        ; 迷路(1行16バイト x 31行。1=壁)
bq:
sx:     .res 96         ; 迷路生成のスタック(部屋のx)。ゲーム中は距離マップのキューに使い回す
sy:     .res 96
cand:   .res 4
dist:   .res 256        ; 主人公までの歩数。(行&15)*16+列。bit7=世代、下位7bit=歩数
rpx:    .res 6          ; ロボ: x
rpl:    .res 6          ; y下位
rph:    .res 6          ; y上位
rmd:    .res 6          ; 進む向き(1=右 2=左 4=下 8=上、0=止まり)
rst:    .res 6          ; 0=待機中 1=歩く 2=穴にはまっている
oldface:.res 1          ; このフレームの前の向き
wasm:   .res 1          ; マスの中心に着いたとき、直前まで歩いていたら非0
turnt:  .res 1          ; 止まった状態から向きを変えたあと、歩き出すまでの残りフレーム
dying:  .res 1          ; >0 の間は主人公が倒れるアニメ(やられたあとの60フレーム)
scol:   .res 1
srow:   .res 1
fbn:    .res 1
scnt:   .res 1
spx:    .res 1
syl:    .res 1
syh:    .res 1
stmp:   .res 1
rrun:   .res 6          ; 出現前に画面の横の余白を走り上がっている(1=左 2=右)
rly:    .res 6          ; その画面のy
rtm:    .res 6          ; 待機・這い出るまでの残り(2フレーム単位)
racc:   .res 6          ; 速さの小数
rimm:   .res 6          ; 1=這い出た直後(その穴では落ちない)
rstp:   .res 6          ; 1=頭を踏まれた
hx:     .res 8          ; 穴(最大8): マスの列・行・残り時間(2フレーム単位。0=なし)
hy:     .res 8
ht:     .res 8
qlo:    .res 8          ; 背景の書き換えキュー(1マス=タイル2x2)
qhi:    .res 8
qtl:    .res 8
qtr:    .res 8
qbl:    .res 8
qbr:    .res 8

.segment "CODE"

reset:
    sei
    cld
    ldx #$40
    stx $4017
    ldx #$FF
    txs
    inx
    stx $2000
    stx $2001
    stx $4010
    bit $2002
:   bit $2002
    bpl :-
    lda #0
    tax
:   sta $0000,x
    sta $0100,x
    sta $0300,x
    sta $0400,x
    sta $0500,x
    sta $0600,x
    sta $0700,x
    inx
    bne :-
    lda #$FF
:   sta oam,x
    inx
    bne :-
:   bit $2002
    bpl :-

    lda #$0F            ; APU: 矩形波2つ・三角波・ノイズを有効に
    sta $4015
    lda #$30
    sta $4000
    sta $4004
    sta $400C
    lda #$80
    sta $4008
    ; パレット
    lda $2002
    lda #$3F
    sta $2006
    lda #$00
    sta $2006
    ldx #0
:   lda palette,x
    sta $2007
    inx
    cpx #32
    bne :-

    jsr load_hi
    jsr show_title

main:
    lda nmiflag
    beq main
    lda #0
    sta nmiflag
    lda cscr
    bne @nosplit
    jsr do_split        ; 表示帯の下端で、迷路(タイトルでは絵)のスクロールに切り替える
    lda title
    bne @nosplit
    jsr update_hud
@nosplit:
    jsr read_pad
    lda padold          ; このフレームに押したボタン
    eor #$FF
    and pad
    sta padnew
    lda pad
    sta padold
    inc seed            ; 乱数の種(遊んでいる間もずっと進める)
    bne :+
    inc seed+1
:   lda title
    beq :+
    jmp @title
:   lda clear
    beq :+
    jmp @clear
:   lda gover
    beq :+
    jmp @over
:   lda intro
    beq :+
    jmp @intro
:   lda dying
    beq :+
    jmp @dying
:   lda paused
    beq :+
    jmp @pause
:   lda padnew
    and #$10            ; Start でポーズ
    beq :+
    jsr enter_pause
    jmp main
:   jsr update_hero
    jsr update_holes
    jsr update_robots
    jsr bfs_step
    jsr check_squeeze
    jsr update_cam
    jsr draw_all
    jmp main
@title:
    lda pad
    and #$10            ; Start で開始
    beq :+
    jsr newgame
    jmp main
:   lda tcam            ; 絵が上から降りてくる(1フレーム2px)。新しく画面の上端に出るマス行を背景に書く
    beq @tfin
    sta tprev
    sec
    sbc #2
    sta tcam
    lsr
    lsr
    lsr
    lsr
    sta u
    lda tprev
    lsr
    lsr
    lsr
    lsr
    cmp u
    beq @tfin
    lda u
    jsr build_trow
    lda #1
    sta pending
@tfin:
    lda tcam
    sta scrl
    inc cblink          ; PUSH START の点滅
    lda cblink
    and #$20
    beq :+
    lda #$0F
    bne @tb
:   lda #$30
@tb:sta pcol
    jsr draw_trobots
    jmp main
@clear:
    lda cscr
    bne @cs
    jsr enter_clear     ; 黒いクリア画面を作る
    jmp main
@cs:
    inc cblink          ; PUSH START の点滅(32フレームごと)
    lda cblink
    and #$20
    beq :+
    lda #$0F
    bne @cc
:   lda #$30
@cc:sta pcol
    jsr draw_cscene     ; 黄色いロボの演出
    lda pad
    and #$10            ; Start で次のステージ(5面のあとは最初から)
    bne @cgo
    jmp main
@cgo:
    lda stage
    cmp #STAGES
    bcs @again
    inc stage
    lda lives           ; ステージクリアで残機が1つ回復(上限3)
    cmp #LIVES0
    bcs @go
    inc lives
@go:
    jsr start_game
    jmp main
@again:
    jsr newgame
    jmp main
@pause:
    lda padnew
    and #$08            ; 上
    beq @pnu
    lda pmenu
    bne :+
    lda #3
:   sec
    sbc #1
    sta pmenu
@pnu:
    lda padnew
    and #$04            ; 下
    beq @pnd
    ldx pmenu
    inx
    cpx #3
    bcc :+
    ldx #0
:   stx pmenu
@pnd:
    lda padnew
    and #$10            ; Start でも戻れる
    beq :+
    jsr leave_pause
    jmp main
:   lda padnew
    and #$80            ; A で決定
    beq @pdraw
    lda pmenu
    beq @presume
    cmp #1
    beq @pretire
    jsr leave_pause     ; 2 = TITLE
    jmp to_title
@pretire:
    jsr leave_pause     ; 1 = RETIRE(わざとミス)
    jsr do_miss
    jmp main
@presume:
    jsr leave_pause
    jmp main
@pdraw:
    jsr draw_pause
    jmp main
@intro:
    dec intro           ; 「STAGE x」を出している間は止まる
    bne @ib
    jsr clear_textoam   ; 終わったら文字を消して、BGMとともに開始
    jsr bgm_start
@ib:
    jsr draw_all
    jmp main
@dying:
    dec dying           ; 倒れるアニメのあいだは全部止まる。終わったら復活
    bne :+
    jsr revive
:   jsr draw_all
    jmp main
@over:
    lda pad
    and #$10            ; Start でやり直し(新しい迷路)
    beq :+
    jsr newgame
    jmp main
:   jsr draw_all
    jmp main

; ---------------------------------------------------------------- ポーズ
; ポーズに入る: 主人公・ロボのスプライトを後ろへずらし、前(OAM 4〜)をウィンドウに使う
; (スプライトは若い番号が手前・優先なので、ウィンドウが敵に隠れず、1行8個の制限でも欠けない)
enter_pause:
    ldx #0
:   lda oam+4,x
    sta oam+144,x
    inx
    cpx #112
    bne :-
    lda bgm_on
    sta bgmwas
    jsr bgm_stop
    lda #0
    sta pmenu
    lda #1
    sta paused
    jmp draw_pause

; ポーズをやめる: ウィンドウを消してスプライトを描き直す(押しっぱなしのA/Bでは掘らない)
leave_pause:
    lda #0
    sta paused
    ldx #4              ; 主人公・ロボ・ウィンドウの跡を全部消す(使っていないロボの枠は draw_all が描かない)
    lda #$FF
:   sta oam,x
    inx
    bne :-
    lda bgmwas
    sta bgm_on
    lda #0
    sta digbuf
    sta ladbuf
    lda #1
    sta digheld
    sta ladheld
    jmp draw_all

; コマンドウィンドウ: 黒い四角に RESUME / RETIRE / TITLE と選択中の矢印(OAM 4〜143)
draw_pause:
    lda #4
    sta to
    LINE padtab, 7, 100, 116
    lda #<tbuf
    sta tp
    lda #>tbuf
    sta tp+1
    lda #7
    sta tn
    lda #100
    sta cx
    ldx #0
@row:
    stx t3              ; 行番号
    lda #$FF
    cpx pmenu
    bne :+
    lda #51             ; 矢印
:   sta tbuf
    txa                 ; ラベル = pause_lbl + 行 x 6
    asl
    sta u
    asl
    clc
    adc u
    tay
    ldx #0
:   lda pause_lbl,y
    sta tbuf+1,x
    iny
    inx
    cpx #6
    bne :-
    lda t3
    asl
    asl
    asl
    clc
    adc #124
    sta cy
    jsr draw_text
    ldx t3
    inx
    cpx #3
    bne @row
    LINE padtab, 7, 100, 148
    rts

pause_lbl:
    .byte 30,27,33,32,26,27         ; R E S U M E
    .byte 30,27,35,50,30,27         ; R E T I R E
    .byte 35,50,35,47,27,$FF        ; T I T L E

; タイトルへ戻る(BGMを止め、状態を全部初期化してタイトル画面を出す)
to_title:
    jsr update_hi
    jsr bgm_stop
    lda #0
    sta hudflag
    sta pending
    sta qhead
    sta qtail
    sta intro
    sta paused
    sta cscr
    sta clear
    sta gover
    sta freezes
    ldx #0
    lda #$FF
:   sta oam,x
    inx
    bne :-
    jsr show_title
    jmp main

; タイトル画面を出す(描画を止めて画面を作り直し、描画を再開する)
show_title:
    lda #0
    sta $2000
    sta $2001
    lda $2002           ; 背景(ネームテーブル)をゼロで埋める
    lda #$20
    sta $2006
    lda #0
    sta $2006
    ldy #16
    ldx #0
@cl:sta $2007
    inx
    bne @cl
    dey
    bne @cl
    lda #$3F            ; 背景色を黒に(ゲームを始めるとき start_game が戻す)
    sta $2006
    lda #0
    sta $2006
    lda #$0F
    sta $2007
    lda #$23            ; 絵(画面A)の属性
    sta $2006
    lda #$C0
    sta $2006
    ldx #0
:   lda titlepic+832,x
    sta $2007
    inx
    cpx #64
    bne :-
    lda #$24            ; 上の表示帯(画面B。HIGH SCORE)
    sta $2006
    lda #0
    sta $2006
    lda #<titlebar
    sta ptr
    lda #>titlebar
    sta ptr+1
    ldy #0
    ldx #4
@tb:lda (ptr),y
    sta $2007
    iny
    bne @tb
    inc ptr+1
    dex
    bne @tb
    lda #$24            ; ハイスコアの数字(3行目の19列目から)
    sta $2006
    lda #$53
    sta $2006
    ldx #0
:   lda hsr,x
    clc
    adc #HUDD0
    sta $2007
    inx
    cpx #5
    bne :-
    ldx #0              ; スプライトは全部隠し、スプライト0だけ置く(画面Bの黒に隠れて見えない)
    lda #$FF
:   sta oam,x
    inx
    bne :-
    lda #30
    sta oam
    lda #56
    sta oam+1
    lda #$23
    sta oam+2
    lda #240
    sta oam+3
    lda #208            ; 絵は画面の外から降りてくる
    sta tcam
    sta scrl
    lda #0
    sta pending
    sta cblink
    lda #$30
    sta pcol
    lda #1
    sta title
    sta seed
    lda #$89
    sta ctrl
    sta $2000
    lda #%00011110
    sta $2001
    rts

; A=絵のマス行(0〜12) → rowbuf・rowbuf2(上下のタイル行)と、輪の中の書き込み先 wrhi:wrlo
build_trow:
    tay
    lda rowlo,y
    sta wrlo
    lda rowhi,y
    sta wrhi
    tya
    lsr
    lsr
    clc
    adc #>(titlepic)
    sta ptr+1
    tya
    and #3
    lsr
    ror
    ror                 ; (行 and 3) x 64
    clc
    adc #<(titlepic)
    sta ptr
    bcc :+
    inc ptr+1
:   ldy #0
:   lda (ptr),y
    sta rowbuf,y
    iny
    cpy #32
    bne :-
    ldx #0
:   lda (ptr),y
    sta rowbuf2,x
    iny
    inx
    cpx #32
    bne :-
    rts

; タイトルの3体のロボ(白・主人公・赤)。絵と一緒に降りてくる(表示帯にかかる間は隠す)
draw_trobots:
    lda tcam
    cmp #113
    bcc @show
    ldx #4
    lda #$FF
:   sta oam,x
    inx
    inx
    inx
    inx
    cpx #52
    bne :-
    rts
@show:
    lda #144
    sec
    sbc tcam
    sta cy
    lda #0
    sta cfr
    sta cfl
    sta chalf
    ldy #4
    lda #96
    sta cx
    lda #0              ; 白いロボ
    sta cat
    jsr draw_char
    lda #120
    sta cx
    lda #1              ; 主人公(黄)
    sta cat
    jsr draw_char
    lda #144
    sta cx
    lda #2              ; 赤いロボ
    sta cat
    jmp draw_char

; ---------------------------------------------------------------- ハイスコア
; 電池つきRAM($6000)に 'H' 'R'・5桁・検査値を置く。RAMが無い/壊れていれば0から
load_hi:
    lda sv_magic
    cmp #$48
    bne @bad
    lda sv_magic+1
    cmp #$52
    bne @bad
    lda #$A5
    sta u
    ldx #4
:   lda sv_hs,x
    cmp #10
    bcs @bad
    eor u
    sta u
    dex
    bpl :-
    lda u
    cmp sv_sum
    bne @bad
    ldx #4
:   lda sv_hs,x
    sta hsr,x
    dex
    bpl :-
    rts
@bad:
    lda #0
    ldx #4
:   sta hsr,x
    dex
    bpl :-
    rts

save_hi:
    lda #$48
    sta sv_magic
    lda #$52
    sta sv_magic+1
    lda #$A5
    sta u
    ldx #4
:   lda hsr,x
    sta sv_hs,x
    eor u
    sta u
    dex
    bpl :-
    lda u
    sta sv_sum
    rts

; いまのスコア(dg)がハイスコアより大きければ更新して保存
update_hi:
    ldx #0
@c: lda dg,x
    cmp hsr,x
    bcc @no
    bne @new
    inx
    cpx #5
    bne @c
@no:rts
@new:
    ldx #4
:   lda dg,x
    sta hsr,x
    dex
    bpl :-
    jmp save_hi

; 最初から(1面・残機・スコアを戻して開始)
newgame:
    lda #1
    sta stage
    lda #0
    sta tgold
    lda #LIVES0
    sta lives
    lda #0
    ldx #4
:   sta dg,x
    dex
    bpl :-
    jmp start_game

stg_cam:  .byte 61, 72, 82, 92, 96          ; スクロール速度(1/256px/フレーム)=0.90〜1.40マス/秒
stg_rspd: .byte 116, 133, 147, 160, 174     ; ロボの速さ=1.70〜2.55マス/秒
stg_red:  .byte 198, 205, 212, 218, 232     ; 赤いロボの速さ=2.9〜3.4マス/秒
stg_resp: .byte 240, 210, 186, 162, 138     ; やられたロボの復活待ち(2フレーム単位)=8.0〜4.6秒


; ---------------------------------------------------------------- 開始
; 描画を止めて、新しい迷路を作り、最初の状態にして、描画を再開する
start_game:
    lda #0
    sta $2000
    sta $2001
    lda seed
    sta rng
    lda seed+1
    sta rng+1
    ora rng
    bne :+
    lda #1
    sta rng
:   ldx #0
    lda #$FF
:   sta oam,x
    inx
    bne :-
    lda #40             ; 左から2マス目(マス1)
    sta px
    lda #<464           ; 下から2行目(マス行29)
    sta pylo
    lda #>464
    sta pyhi
    lda #<START_CAM
    sta camlo
    lda #>START_CAM
    sta camhi
    lda #0
    sta camf
    sta dir
    sta flip
    sta gover
    sta campause
    sta mdir
    sta anim
    sta atimer
    sta pending
    sta title
    sta cscr
    sta hstate
    sta digbuf
    sta digheld
    sta ladbuf
    sta ladheld
    sta qhead
    sta qtail
    sta fc
    ldx #7
:   sta ht,x
    dex
    bpl :-
    sta invinc
    sta chalf
    sta bfs_on
    sta epoch
    sta clear
    sta golds
    sta pushtimer
    lda #INTRO_FR       ; 開始前に「STAGE x」を3秒出す
    sta intro
    lda #0
    sta dying
    lda #<SCROLL_WAIT
    sta sdelay
    lda #>SCROLL_WAIT
    sta sdelay+1
    lda #3
    sta ladders
    lda #0
    lda #255
    sta bestrow
    lda #0
    sta freezes
    sta swon
    ldx stage           ; このステージの速さなど(表は0始まり)
    dex
    lda stg_cam,x
    sta camspd
    lda stg_rspd,x
    sta rspd
    lda stg_resp,x
    sta rrsp
    lda stg_red,x
    sta rspr
    lda #0
    sta redsp
    lda stage           ; ロボの数 = ステージ番号
    sta nrob
    sec
    sbc #1
    sta nrobm1
    ldx #5              ; ロボは待機から(番号5は赤いロボ=スクロールが止まるまで出ない)(2秒+1.4秒ずつずらして出る)
:   lda #0
    sta rst,x
    sta rrun,x
    sta rmd,x
    sta racc,x
    sta rimm,x
    sta rstp,x
    dex
    bpl :-
    lda #60
    sta rtm
    lda #102
    sta rtm+1
    lda #144
    sta rtm+2
    lda #186
    sta rtm+3
    lda #228
    sta rtm+4
    ldx #0              ; 距離マップは「遠い」で埋める
    lda #$7F
:   sta dist,x
    inx
    bne :-
    lda #8
    sta face
    lda #0
    sta turnt
    sta wasm
    jsr gen_maze
    jsr place_watch
    ; 画面に最初から出る行(マス行16〜30)を背景に書いておく
    lda #(START_CAM / 16)
    sta ltop
    sta rr
:   lda rr
    jsr build_row
    jsr write_row
    inc rr
    lda rr
    cmp #ROWS
    bne :-
    jsr set_scroll
    lda #30             ; スプライト0: 表示帯の区切り線(31行目)に重ねる。ここで切り替える
    sta oam
    lda #56
    sta oam+1
    lda #3
    sta oam+2
    lda #240
    sta oam+3
    lda $2002           ; タイトルの色(背景色=黒)と属性を戻す
    lda #$3F
    sta $2006
    lda #0
    sta $2006
    lda #$29
    sta $2007
    lda #$23
    sta $2006
    lda #$C0
    sta $2006
    lda #0
    ldx #64
:   sta $2007
    dex
    bne :-
    lda $2002           ; 表示帯(画面B)を書く
    lda #$24
    sta $2006
    lda #0
    sta $2006
    lda #<hudnt
    sta ptr
    lda #>hudnt
    sta ptr+1
    ldy #0
    ldx #4
@hd:lda (ptr),y
    sta $2007
    iny
    bne @hd
    inc ptr+1
    dex
    bne @hd
    ldx #15
    lda #$FF
:   sta hudbuf,x
    dex
    bpl :-
    jsr update_hud      ; 数字を最新に
    jsr write_hud
    lda #0
    sta hudflag
    lda #$89            ; 画面Bから(スプライトは$1000)
    sta ctrl
    bit $2002
:   bit $2002
    bpl :-
    lda ctrl
    sta $2000
    lda #%00011110
    sta $2001
    lda #0
    sta nmiflag
    rts

; ストップウォッチを1つ置く: 迷路の高さの30〜70%(奇数行9〜21)の、金塊のない奇数列の部屋
place_watch:
    lda #7
    sta md
    jsr rand
    jsr rmod
    asl
    clc
    adc #9
    sta swcy
    lda #6
    sta md
    jsr rand
    jsr rmod
    asl
    clc
    adc #1
    sta swcx
    ldx #6
@w: ldy swcx
    lda swcy
    jsr getcell
    beq @ok
    lda swcx
    clc
    adc #2
    cmp #12
    bcc :+
    lda #1
:   sta swcx
    dex
    bne @w
@ok:
    lda #1
    sta swon
    rts

; ---------------------------------------------------------------- 表示帯
; 画面の上の32pxは、迷路とは別の画面B(固定)。黒地に白い数字を背景タイルで出す。
; スプライト0が区切り線に当たった行で、迷路の窓のスクロールに切り替える。
do_split:
    lda scrl            ; 切り替えに使う値を先に作っておく
    and #$38
    asl
    asl
    sta sp2
    lda #0
    sta u
    sta v
@w0:bit $2002           ; 前のフレームの当たりが消えるまで待つ
    bvc @w1
    inc u
    bne @w0
    inc v
    lda v
    cmp #12
    bne @w0
    rts
@w1:lda #0
    sta u
    sta v
@w2:bit $2002           ; スプライト0の当たりを待つ
    bvs @hit
    inc u
    bne @w2
    inc v
    lda v
    cmp #40
    bne @w2
    rts
@hit:
    lda #0              ; 画面A・スクロール(0, scrl)
    sta $2006
    lda scrl
    sta $2005
    lda #0
    sta $2005
    lda sp2
    sta $2006
    rts

; 表示帯の数字(hudbuf)を最新にして、変わっていれば hudflag を立てる
update_hud:
    ldx #0
@sc:lda dg,x
    clc
    adc #HUDV0
    jsr hud_set
    inx
    cpx #5
    bne @sc
    ldx #5              ; 残機: 残りの数だけ黄色いロボの頭(3つぶんの枠)
@lf:txa
    sec
    sbc #5
    cmp lives
    lda #HUDBLANK
    bcs :+
    lda #HUDHEAD
:   jsr hud_set
    inx
    cpx #8
    bne @lf
    lda freezes         ; ストップウォッチの残り秒
    beq @nostop
    ldy #HUDBLANK
    cmp #10
    bcc :+
    sbc #10
    ldy #HUDV0+1
:   clc
    adc #HUDV0
    pha
    tya
    ldx #8
    jsr hud_set
    pla
    ldx #9
    jsr hud_set
    jmp @stage
@nostop:
    lda #HUDBLANK
    ldx #8
    jsr hud_set
    lda #HUDBLANK
    ldx #9
    jsr hud_set
@stage:
    lda stage
    clc
    adc #HUDV0
    ldx #10
    jsr hud_set
    lda golds
    ldy #0
    cmp #10
    bcc :+
    sbc #10
    ldy #1
:   clc
    adc #HUDV0
    pha
    tya
    clc
    adc #HUDV0
    ldx #11
    jsr hud_set
    pla
    ldx #12
    jsr hud_set
    ldx #13             ; ハシゴ: 残りの数だけハシゴの絵
@ld:txa
    sec
    sbc #13
    cmp ladders
    lda #HUDBLANK
    bcs :+
    lda #HUDLAD
:   jsr hud_set
    inx
    cpx #16
    bne @ld
    rts

; A=タイル、X=番号。変わっていたら書き換えを予約
hud_set:
    cmp hudbuf,x
    beq @r
    sta hudbuf,x
    lda #1
    sta hudflag
@r: rts

.macro HUDADDR hi, lo
    lda #hi
    sta $2006
    lda #lo
    sta $2006
.endmacro

; 表示帯の数字(と残機・ハシゴの絵)を背景に書く(NMIか、描画オフのとき)
write_hud:
    lda $2002
    HUDADDR $24, $27    ; スコア5桁
    ldx #0
:   lda hudbuf,x
    sta $2007
    inx
    cpx #5
    bne :-
    HUDADDR $24, $33    ; 残機(頭3つ)
    ldx #5
:   lda hudbuf,x
    sta $2007
    inx
    cpx #8
    bne :-
    HUDADDR $24, $3B    ; ストップウォッチ
    lda hudbuf+8
    sta $2007
    lda hudbuf+9
    sta $2007
    HUDADDR $24, $47    ; ステージ
    lda hudbuf+10
    sta $2007
    HUDADDR $24, $4F    ; 金塊
    lda hudbuf+11
    sta $2007
    lda hudbuf+12
    sta $2007
    HUDADDR $24, $5A    ; ハシゴ(3つ)
    ldx #13
:   lda hudbuf,x
    sta $2007
    inx
    cpx #16
    bne :-
    rts

; ---------------------------------------------------------------- 音
; BGM: 矩形波1(メロディ)+三角波(ベース)。効果音: 矩形波2+ノイズ。毎フレームNMIで進める。
; 曲のデータは「音符,長さ(フレーム)」の並び(tools/make_sound.py が作る)。
bgm_start:
    lda #<bgm_mel
    sta m1p
    lda #>bgm_mel
    sta m1p+1
    lda #<bgm_bass
    sta m2p
    lda #>bgm_bass
    sta m2p+1
    lda #0
    sta m1c
    sta m2c
    lda #1
    sta bgm_on
    rts

bgm_stop:
    lda #0
    sta bgm_on
    lda #$30
    sta $4000
    lda #$80
    sta $4008
    rts

sound_update:
    ; --- 効果音の要求
    lda sfx_req
    beq @norq
    tax
    dex
    lda #0
    sta sfx_req
    lda sfxlo,x
    ora sfxhi,x
    beq @nopulse
    lda sfxlo,x
    sta spp
    lda sfxhi,x
    sta spp+1
    lda #1
    sta spon
    lda #0
    sta spc
@nopulse:
    lda nzlen,x
    beq @norq
    sta snc
    lda nzvol,x
    sta snv
    lda nzper,x
    sta $400E
    lda #$08
    sta $400F
@norq:
    ; --- ノイズ(だんだん小さくなる)
    lda snc
    beq @nzoff
    dec snc
    and #1
    bne :+
    lda snv
    beq :+
    dec snv
:   lda snv
    ora #$30
    sta $400C
    jmp @nzdone
@nzoff:
    lda #$30
    sta $400C
@nzdone:
    ; --- 効果音の矩形波(矩形波2)
    lda spon
    beq @spdone
    lda spc
    bne @sptick
    ldy #0
    lda (spp),y
    cmp #$FE
    bne @spn
    lda #0              ; 曲の終わり
    sta spon
    lda #$30
    sta $4004
    jmp @spdone
@spn:
    sta spn
    iny
    lda (spp),y
    sta spc
    lda spp
    clc
    adc #2
    sta spp
    bcc :+
    inc spp+1
:   lda #0
    sta spt
    ldx spn
    beq @sptick
    lda perlo-1,x
    sta $4006
    lda perhi-1,x
    sta $4007
@sptick:
    dec spc
    inc spt
    lda spn
    beq @spsil
    lda spt             ; 音量: 12から2フレームで1ずつ下がる(下限3)
    lsr
    sta tmp
    lda #12
    sec
    sbc tmp
    bcs :+
    lda #0
:   cmp #3
    bcs :+
    lda #3
:   ora #$70            ; デューティ25%・音量固定
    sta $4004
    jmp @spdone
@spsil:
    lda #$30
    sta $4004
@spdone:
    ; --- BGM
    lda bgm_on
    bne :+
    rts
:   lda freezes         ; ストップウォッチで止まっている間はBGMもとめる
    beq @bgmrun
    lda #$30
    sta $4000
    lda #$80
    sta $4008
    jmp @bgmdone
@bgmrun:
    lda m1c             ; メロディ
    bne @m1tick
@m1f:
    ldy #0
    lda (m1p),y
    cmp #$FF
    bne @m1n
    lda #<bgm_mel       ; 曲の頭へ
    sta m1p
    lda #>bgm_mel
    sta m1p+1
    jmp @m1f
@m1n:
    sta m1n
    iny
    lda (m1p),y
    sta m1c
    lda m1p
    clc
    adc #2
    sta m1p
    bcc :+
    inc m1p+1
:   lda #0
    sta m1t
    ldx m1n
    beq @m1tick
    lda perlo-1,x
    sta $4002
    lda perhi-1,x
    sta $4003
@m1tick:
    dec m1c
    inc m1t
    lda m1n
    beq @m1sil
    lda m1t             ; 音量: 11から4フレームで1ずつ下がる(下限5)
    lsr
    lsr
    sta tmp
    lda #11
    sec
    sbc tmp
    bcs :+
    lda #0
:   cmp #5
    bcs :+
    lda #5
:   ora #$B0            ; デューティ50%・音量固定
    sta $4000
    jmp @m2
@m1sil:
    lda #$30
    sta $4000
@m2:
    lda m2c             ; ベース
    bne @m2tick
@m2f:
    ldy #0
    lda (m2p),y
    cmp #$FF
    bne @m2n
    lda #<bgm_bass
    sta m2p
    lda #>bgm_bass
    sta m2p+1
    jmp @m2f
@m2n:
    sta m2n
    iny
    lda (m2p),y
    sta m2c
    lda m2p
    clc
    adc #2
    sta m2p
    bcc :+
    inc m2p+1
:   ldx m2n
    beq @m2tick
    lda trilo-1,x
    sta $400A
    lda trihi-1,x
    sta $400B
@m2tick:
    dec m2c
    lda m2n
    beq @m2sil
    lda #$FF
    sta $4008
    jmp @bgmdone
@m2sil:
    lda #$80
    sta $4008
@bgmdone:
    rts

; ---------------------------------------------------------------- 乱数・迷路生成
; 16bit LFSR(ガロア型)を3歩進めて下位バイトを返す
rand:
    ldx #3
:   lsr rng+1
    ror rng
    bcc :+
    lda rng+1
    eor #$B4
    sta rng+1
:   dex
    bne :--
    lda rng
    rts

; A mod md → A
rmod:
:   cmp md
    bcc :+
    sbc md
    jmp :-
:   rts

; A=y → ptr = mapram + y*16
cellptr:
    sta ptr
    lsr
    lsr
    lsr
    lsr
    sta ptr+1
    lda ptr
    asl
    asl
    asl
    asl
    clc
    adc #<mapram
    sta ptr
    lda ptr+1
    adc #>mapram
    sta ptr+1
    rts

; A=y, Y=x → A=その場所の値(1=壁)
getcell:
    jsr cellptr
    lda (ptr),y
    rts

; A=y, Y=x → 床にする
opencell:
    jsr cellptr
    lda #0
    sta (ptr),y
    rts

; growing tree 方式で迷路を作る。部屋は奇数x奇数の 6x15 個。スタートは一番下の左(1,29)。
gen_maze:
    ldx #0
    lda #1
:   sta mapram,x
    sta mapram+256,x
    inx
    bne :-
    lda #1
    sta gx
    lda #29
    sta gy
    tay
    ldy gx
    jsr opencell
    lda #1
    sta sx
    lda #29
    sta sy
    lda #1
    sta ssz
@loop:
    lda ssz
    bne @go
    jmp @extra
@go:
    ; 半分は一番新しい部屋、半分はスタックの中からランダム
    jsr rand
    bmi @rnd
    ldx ssz
    dex
    jmp @pick
@rnd:
    lda ssz
    sta md
    jsr rand
    jsr rmod
    tax
@pick:
    stx cur
    lda sx,x
    sta gx
    lda sy,x
    sta gy
    ; となり(2マス先)で、まだ掘っていない部屋を数える
    lda #0
    sta ncand
    lda gx              ; 右
    clc
    adc #2
    cmp #12
    bcs @nR
    tay
    lda gy
    jsr getcell
    beq @nR
    lda #0
    jsr addcand
@nR:
    lda gx              ; 左
    cmp #3
    bcc @nL
    sec
    sbc #2
    tay
    lda gy
    jsr getcell
    beq @nL
    lda #1
    jsr addcand
@nL:
    lda gy              ; 下
    clc
    adc #2
    cmp #30
    bcs @nD
    sta u
    ldy gx
    lda u
    jsr getcell
    beq @nD
    lda #2
    jsr addcand
@nD:
    lda gy              ; 上
    cmp #3
    bcc @nU
    sec
    sbc #2
    sta u
    ldy gx
    lda u
    jsr getcell
    beq @nU
    lda #3
    jsr addcand
@nU:
    lda ncand
    bne @carve
    ; 行き止まり: この部屋をスタックから外す(最後の要素をここへ)
    dec ssz
    ldx ssz
    lda sx,x
    ldy cur
    sta sx,y
    lda sy,x
    sta sy,y
    jmp @loop
@carve:
    sta md
    jsr rand
    jsr rmod
    tax
    lda cand,x
    tax
    ; 間のマスと次の部屋を床にする
    lda gx
    clc
    adc dxm,x
    tay
    lda gy
    clc
    adc dym,x
    stx u
    jsr opencell
    ldx u
    lda gx
    clc
    adc dxm,x
    clc
    adc dxm,x
    sta nx
    tay
    lda gy
    clc
    adc dym,x
    clc
    adc dym,x
    sta ny
    jsr opencell
    ldx ssz
    lda nx
    sta sx,x
    lda ny
    sta sy,x
    inc ssz
    jmp @loop
@extra:
    ; 壁をランダムに45か所抜いて、行き止まりを減らす
    ldx #45
    stx cur
@e: lda #11
    sta md
    jsr rand
    jsr rmod
    clc
    adc #1
    sta gx
    lda #29
    sta md
    jsr rand
    jsr rmod
    clc
    adc #1
    sta gy
    lda gx
    eor gy
    and #1
    beq @ne             ; 偶奇が同じ(部屋または柱)はそのまま
    ldy gx
    lda gy
    jsr opencell
@ne:dec cur
    bne @e
    ; 出口: 一番上の行(行0)の、奇数列のどれか1か所。下の部屋は必ず空いている
    lda #6
    sta md
    jsr rand
    jsr rmod
    asl
    clc
    adc #1
    tay
    lda #3
    sta sd
    lda #0
    jsr setcell
    ; 金塊: 行を10の帯に分けて、それぞれ1つ(奇数行・奇数列の部屋のどこか)
    lda #0
    sta cur
@g: lda cur
    asl
    clc
    adc cur             ; 3*帯
    lsr                 ; 帯k の行番号(0〜14番目の奇数行)= (3k)/2 + 0か1
    sta gy
    jsr rand
    and #1
    clc
    adc gy
    cmp #14
    bcc :+
    lda #13             ; 一番下の通路(行29)には置かない
:   asl
    clc
    adc #1
    sta gy              ; 奇数行 1〜27
    lda #6
    sta md
    jsr rand
    jsr rmod
    asl
    clc
    adc #1
    sta gx
    ldx #6              ; すでに金塊があれば、となりの部屋へずらす
@gp:ldy gx
    lda gy
    jsr getcell
    beq @gok
    lda gx
    clc
    adc #2
    cmp #12
    bcc :+
    lda #1
:   sta gx
    dex
    bne @gp
    beq @gn
@gok:
    lda #5
    sta sd
    ldy gx
    lda gy
    jsr setcell
@gn:inc cur
    lda cur
    cmp #10
    bne @g
    ; 一番下の通路(行29)は全部あける
    ldy #1
@b: lda #29
    sty u
    jsr opencell
    ldy u
    iny
    cpy #12
    bne @b
    rts

; A=向き(0=右 1=左 2=下 3=上)を候補に足す
addcand:
    ldx ncand
    sta cand,x
    inc ncand
    rts

dxm: .byte 1, $FF, 0, 0
dym: .byte 0, 0, 1, $FF

; tp の文字表(tn個、$FFは空白)を、x=cx、y=cy から横に並べて描く(OAMの to〜)
; 1行に並べられるスプライトは8個まで
draw_text:
    ldx to
    ldy #0
@l: lda (tp),y
    cmp #$FF
    bne @g
    lda #49             ; 空白は黒い四角
@g: sta oam+1,x
    lda cy
    sec
    sbc #1
    sta oam,x
    lda #3
    sta oam+2,x
    tya
    asl
    asl
    asl
    clc
    adc cx
    sta oam+3,x
    inx
    inx
    inx
    inx
    iny
    cpy tn
    bne @l
    stx to              ; 次の行はこの続きに
    rts

; 文字用のスプライト(OAM 116〜235)を消す
clear_textoam:
    ldx #116
    lda #$FF
:   sta oam,x
    inx
    inx
    inx
    inx
    cpx #236
    bne :-
    rts

; ゲーム画面の上に出す文字(黒い四角の中に白い文字。上下の余白の行つき)
draw_intro:
    ldx #5              ; S T A G E _ x
:   lda txt_stage,x
    sta tbuf,x
    dex
    bpl :-
    lda stage
    clc
    adc #36
    sta tbuf+6
    lda #116
    sta to
    LINE padtab, 7, 100, 120
    LINE tbuf, 7, 100, 128
    LINE padtab, 7, 100, 136
    rts

draw_gameover:
    lda #116
    sta to
    LINE padtab, 6, 104, 116
    LINE goover1, 6, 104, 124
    LINE padtab, 6, 104, 132
    LINE goover2, 6, 104, 140
    LINE padtab, 6, 104, 148
    rts

nmi:
    pha
    txa
    pha
    tya
    pha
    lda pending
    beq @nopend
    jsr write_row
    lda #0
    sta pending
    jmp @qs
@nopend:
    lda hudflag         ; 表示帯の数字(行を書かないフレームだけ)
    beq @qs
    jsr write_hud
    lda #0
    sta hudflag
@qs:
    lda #2              ; 穴の絵の書き換え(1フレームに2マスまで)
    sta qn
@q: lda qn
    beq @qd
    ldx qhead
    cpx qtail
    beq @qd
    lda $2002
    lda qhi,x
    sta $2006
    lda qlo,x
    sta $2006
    lda qtl,x
    sta $2007
    lda qtr,x
    sta $2007
    lda qlo,x
    clc
    adc #32
    tay
    lda qhi,x
    adc #0
    sta $2006
    sty $2006
    lda qbl,x
    sta $2007
    lda qbr,x
    sta $2007
    inx
    txa
    and #7
    sta qhead
    dec qn
    jmp @q
@qd:
    lda #0
    sta $2003
    lda #>oam
    sta $4014
    lda cscr            ; クリア画面・タイトル: PUSH START の点滅(背景パレット2の色2)
    ora title
    beq @nocs
    lda $2002
    lda #$3F
    sta $2006
    lda #$0A
    sta $2006
    lda pcol
    sta $2007
@nocs:
    lda #0              ; 画面の一番上は表示帯(画面B)。迷路の窓は do_split で切り替える
    sta $2005
    sta $2005
    lda ctrl
    sta $2000
    jsr sound_update
    lda #1
    sta nmiflag
    pla
    tay
    pla
    tax
    pla
    rti

irq:
    rti

read_pad:
    lda #1
    sta $4016
    sta pad
    lsr a
    sta $4016
:   lda $4016
    lsr a
    rol pad
    bcc :-
    rts

; ---------------------------------------------------------------- カメラ
; カメラを上へ少しずつ進め(0で止まる)、新しく画面の上端に出るマス行を背景に書く
update_cam:
    lda sdelay          ; 開始から5秒はスクロールしない
    ora sdelay+1
    beq @nsd
    lda sdelay
    bne :+
    dec sdelay+1
:   dec sdelay
    jmp set_scroll
@nsd:
    lda freezes         ; ストップウォッチで止まっている間
    beq @nofz
    dec freezef
    bne @fzs
    lda #60
    sta freezef
    dec freezes
@fzs:
    jmp set_scroll
@nofz:
    lda campause
    beq :+
    dec campause
    jmp set_scroll
:   lda camlo
    ora camhi
    beq @fin
    lda camf
    sec
    sbc camspd
    sta camf
    lda camlo
    sbc #0
    sta camlo
    lda camhi
    sbc #0
    sta camhi
    ; 画面の一番上のマス行 = cam / 16
    lda camlo
    lsr
    lsr
    lsr
    lsr
    sta u
    lda camhi
    asl
    asl
    asl
    asl
    ora u
    cmp ltop
    bcs @fin
    sta ltop
    jsr build_row       ; A=新しい上端の行 → rowbuf と書き込み先
    lda #1
    sta pending
@fin:
    jmp set_scroll

; カメラ(世界座標y)→ 迷路窓のスクロールY(輪は240px=縦ミラーの1画面分。世界yを240で割った余り)
set_scroll:
    lda camhi
    bne @sub
    lda camlo
    cmp #240
    bcc @st
@sub:
    lda camlo
    sec
    sbc #240
@st:sta scrl
    rts

; ---------------------------------------------------------------- 背景の行
; A=マス行 → rowbuf(32タイル)を作り、輪の中の書き込み先 wrhi:wrlo を決める
build_row:
    sta rr
    lsr
    lsr
    lsr
    lsr
    sta ptr+1
    lda rr
    asl
    asl
    asl
    asl
    sta ptr
    clc
    lda ptr
    adc #<mapram
    sta ptr
    lda ptr+1
    adc #>mapram
    sta ptr+1
    ldx #0
@l: ldy colcell,x
    cpy #$FF
    beq @fl
    lda (ptr),y
    beq @fl
    cmp #2
    beq @fl             ; 穴は床として(読み込み時には穴は無い)
    cmp #1
    beq @wall
    cmp #3
    beq @goal
    cmp #4
    beq @lad
    lda #12             ; 5=金塊(タイル12〜15)
    bne @big
@lad:
    lda #16             ; 4=ハシゴ(タイル16〜19)
@big:
    sta tmp
    txa
    clc
    adc #1
    and #1              ; 左右どちらのタイルか(タイル列3から始まるマス)
    clc
    adc tmp
    sta rowbuf,x
    clc
    adc #2
    sta rowbuf2,x
    jmp @nx
@wall:
    lda #2
    bne @same
@goal:
    lda #11
    bne @same
@fl:lda #1
@same:
    sta rowbuf,x
    sta rowbuf2,x
@nx:inx
    cpx #32
    bne @l
    ldy rr              ; 行 → 輪の中の書き込み先(表は mod 15 済み)
    lda rowlo,y
    sta wrlo
    lda rowhi,y
    sta wrhi
    rts

; rowbuf を2回(=タイル2行=マス1行分)書く
write_row:
    lda $2002
    lda wrhi
    sta $2006
    lda wrlo
    sta $2006
    ldx #0
@a: lda rowbuf,x
    sta $2007
    inx
    cpx #32
    bne @a
    ldx #0
@b: lda rowbuf2,x
    sta $2007
    inx
    cpx #32
    bne @b
    rts

; ---------------------------------------------------------------- 当たり判定
; A=x(px)、X=マス行 → A=その壁の値(0=通れる)
mapat:
    sec
    sbc #24             ; 迷路の左端(3タイル=24px)
    lsr
    lsr
    lsr
    lsr
    tay
    txa
    lsr
    lsr
    lsr
    lsr
    sta ptr+1
    txa
    asl
    asl
    asl
    asl
    sta ptr
    clc
    lda ptr
    adc #<mapram
    sta ptr
    lda ptr+1
    adc #>mapram
    sta ptr+1
    lda (ptr),y
    rts

; u(下位),v(上位)の世界座標y → A=マス行
tocell:
    lda u
    lsr
    lsr
    lsr
    lsr
    sta u
    lda v
    asl
    asl
    asl
    asl
    ora u
    rts

; 主人公の当たり(16x16の内側2px引き)が壁に重なればC=1
blocked:
    lda px
    clc
    adc #2
    sta bx0
    lda px
    clc
    adc #13
    sta bx1
    lda pylo
    clc
    adc #2
    sta u
    lda pyhi
    adc #0
    sta v
    jsr tocell
    sta cya
    lda pylo
    clc
    adc #13
    sta u
    lda pyhi
    adc #0
    sta v
    jsr tocell
    sta cyb
    lda bx0
    ldx cya
    jsr mapat
    cmp #1
    beq @yes
    lda bx1
    ldx cya
    jsr mapat
    cmp #1
    beq @yes
    lda bx0
    ldx cyb
    jsr mapat
    cmp #1
    beq @yes
    lda bx1
    ldx cyb
    jsr mapat
    cmp #1
    beq @yes
    clc
    rts
@yes:
    sec
    rts

; ---------------------------------------------------------------- 穴
; 向いている先のマスが床なら穴を掘り、穴ならうめる(壁は何もしない)
; 向いている先のマスを (dcx,dcy) に求める。範囲外ならC=1
calc_target:
    lda px
    sec
    sbc #24
    lsr
    lsr
    lsr
    lsr
    sta dcx
    lda pylo
    sta u
    lda pyhi
    sta v
    jsr tocell
    sta dcy
    lda face
    lsr
    bcc :+
    inc dcx
    jmp @t
:   lsr
    bcc :+
    dec dcx
    jmp @t
:   lsr
    bcc :+
    inc dcy
    jmp @t
:   dec dcy
@t: lda dcx
    cmp #12
    bcs @out
    lda dcy
    cmp #31
    bcs @out
    clc
    rts
@out:
    sec
    rts

; Bボタン: 壁に向かって止まったあと(1.5秒以内)なら、向いている壁をハシゴにする
; (外周とゴールの行は除く。ゴールの次の行にはかけられる。ハシゴは1ステージに3本)
do_ladder:
    lda ladders
    beq @no
    lda pushtimer
    beq @no
    jsr calc_target
    bcs @no
    ldy dcx
    lda dcy
    jsr getcell
    cmp #1
    bne @no
    lda dcx
    beq @no
    lda dcy
    cmp #2
    bcc @no
    lda #4
    sta sd
    ldy dcx
    lda dcy
    jsr setcell
    dec ladders
    lda #0
    sta pushtimer
    lda #SFX_LADDER
    sta sfx_req
    lda #16             ; ハシゴのタイル
    jmp qcell
@no:
    rts

; Aボタン: 向いている先のマスが床なら穴を掘り、穴ならうめる(壁は何もしない)。自動ねらいはしない
do_dig:
    jsr calc_target
    bcs @no
    ldy dcx
    lda dcy
    jsr getcell
    beq @dig
    cmp #2
    beq @fill
@no:
    rts
@dig:
    ldx #7              ; あいている穴の番号を探す
:   lda ht,x
    beq @free
    dex
    bpl :-
    rts
@free:
    lda #SFX_DIG
    sta sfx_req
    lda dcx
    sta hx,x
    lda dcy
    sta hy,x
    lda #HOLE_T
    sta ht,x
    lda #2
    sta sd
    ldy dcx
    lda dcy
    jsr setcell
    lda #3              ; 大きい穴のタイル
    jmp qcell
@fill:
    ldx #7              ; その場所の穴を探して消す
:   lda ht,x
    beq @nx
    lda hx,x
    cmp dcx
    bne @nx
    lda hy,x
    cmp dcy
    beq @found
@nx:dex
    bpl :-
    rts
@found:
    lda #SFX_DIG
    sta sfx_req
    lda #0
    sta ht,x
    sta sd
    ldy dcx
    lda dcy
    jsr setcell
    jsr qfloor
    jmp crush_cell

; A=y, Y=x に sd の値を書く
setcell:
    jsr cellptr
    lda sd
    sta (ptr),y
    rts

; (dcx,dcy)のマスを、A番から始まる2x2のタイルで書き換える予約をする(NMIで書く)
qcell:
    sta t0
    clc
    adc #1
    sta t1
    adc #1
    sta t2
    adc #1
    sta t3
    jmp qpush
qfloor:
    lda #1
    sta t0
    sta t1
    sta t2
    sta t3
qpush:
    ldy dcy             ; 輪の中の行(表は mod 15 済み)
    lda rowlo,y
    sta wrlo
    lda rowhi,y
    sta wrhi
    lda dcx             ; タイルの列 = 3 + 2*列
    asl
    clc
    adc #3
    clc
    adc wrlo
    sta wrlo
    bcc :+
    inc wrhi
:   ldx qtail
    lda wrlo
    sta qlo,x
    lda wrhi
    sta qhi,x
    lda t0
    sta qtl,x
    lda t1
    sta qtr,x
    lda t2
    sta qbl,x
    lda t3
    sta qbr,x
    inx
    txa
    and #7
    sta qtail
    rts

; 毎フレーム: 穴の残り時間を進める(2フレームに1回)。小さくなり、ふさがる
update_holes:
    inc fc
    lda fc
    and #1
    bne @done
    ldx #7
@h: stx hidx
    lda ht,x
    beq @n
    dec ht,x
    lda ht,x
    cmp #HOLE_SMALL
    bne @c0
    lda hx,x
    sta dcx
    lda hy,x
    sta dcy
    lda #7              ; 小さい穴のタイル
    jsr qcell
    jmp @n
@c0:
    cmp #0
    bne @n
    ldx hidx
    lda hx,x
    sta dcx
    lda hy,x
    sta dcy
    lda #0
    sta sd
    ldy dcx
    lda dcy
    jsr setcell
    jsr qfloor
    jsr crush_cell
    lda hstate          ; 中に落ちている主人公がいたらミス
    cmp #1
    bne @n
    lda px
    sec
    sbc #24
    lsr
    lsr
    lsr
    lsr
    cmp dcx
    bne @n
    lda pylo
    sta u
    lda pyhi
    sta v
    jsr tocell
    cmp dcy
    bne @n
    lda #0
    sta hstate
    jsr do_miss
@n: ldx hidx
    dex
    bpl @h
@done:
    rts

; ---------------------------------------------------------------- スコア
; A=百点の数(1=100点) をスコアに足す
addscore:
    clc
    adc dg+2
    sta dg+2
addnorm:
    lda dg+2
    cmp #10
    bcc @b
    sbc #10
    sta dg+2
    inc dg+1
    jmp addnorm
@b: lda dg+1
    cmp #10
    bcc @c
    sbc #10
    sta dg+1
    inc dg
    jmp @b
@c: lda dg
    cmp #10
    bcc @d
    lda #9              ; 上限
    sta dg
    sta dg+1
    sta dg+2
    sta dg+3
    sta dg+4
@d: rts

; 10点を足す
addten:
    inc dg+3
    lda dg+3
    cmp #10
    bcc @r
    lda #0
    sta dg+3
    inc dg+2
    jmp addnorm
@r: rts

; ---------------------------------------------------------------- 主人公までの距離(幅優先探索)
; 16フレームごとに主人公の居るマスから始めて、1フレームに24マスずつ広げる。
; 結果は dist に(行&15)*16+列で入る。壁は通らない(穴は通る)。
bfs_step:
    lda bfs_on
    bne @run
    lda fc
    and #15
    bne @ret
    lda epoch           ; 新しい世代
    eor #$80
    sta epoch
    lda camlo
    lsr
    lsr
    lsr
    lsr
    sta u
    lda camhi
    asl
    asl
    asl
    asl
    ora u
    sta btop
    lda px              ; 主人公の中心のマス
    clc
    adc #8
    sec
    sbc #24
    lsr
    lsr
    lsr
    lsr
    sta dcx
    lda pylo
    clc
    adc #8
    sta u
    lda pyhi
    adc #0
    sta v
    jsr tocell
    sta dcy
    sec
    sbc btop
    cmp #16
    bcs @ret            ; 範囲外ならやめておく
    asl
    asl
    asl
    asl
    ora dcx
    sta bq              ; キューの先頭=(オフセット<<4|列)
    lda dcy
    and #15
    asl
    asl
    asl
    asl
    ora dcx
    tax
    lda epoch
    sta dist,x          ; 歩数0
    lda #0
    sta bqh
    lda #1
    sta bqt
    sta bfs_on
@ret:
    rts
@run:
    lda #24
    sta bc
@pop:
    lda bqh
    cmp bqt
    bne @has
    jmp @done
@has:
    tax
    inc bqh
    lda bq,x
    sta v
    and #15
    sta gx              ; 列
    lda v
    lsr
    lsr
    lsr
    lsr
    sta gy              ; オフセット(btopからの行数)
    lda btop
    clc
    adc gy
    and #15
    asl
    asl
    asl
    asl
    ora gx
    tax
    lda dist,x
    and #$7F
    clc
    adc #1
    cmp #$7F
    bcc :+
    lda #$7E
:   sta bd
    lda #0
    sta kk
@nb:
    ldx kk
    lda gx
    clc
    adc dxm,x
    sta nx
    lda gy
    clc
    adc dym,x
    sta ny
    cmp #16
    bcs @skip
    lda btop
    clc
    adc ny
    ldy nx
    jsr getcell
    cmp #1
    beq @skip           ; 壁
    lda btop
    clc
    adc ny
    and #15
    asl
    asl
    asl
    asl
    ora nx
    tax
    lda dist,x
    and #$80
    cmp epoch
    beq @skip           ; この世代でもう届いている
    lda epoch
    ora bd
    sta dist,x
    lda ny
    asl
    asl
    asl
    asl
    ora nx
    ldx bqt
    sta bq,x
    inc bqt
@skip:
    inc kk
    lda kk
    cmp #4
    bne @nb
    dec bc
    beq @quit
    jmp @pop
@quit:
    rts
@done:
    lda #0
    sta bfs_on
    rts

; ---------------------------------------------------------------- ロボ
update_robots:
    lda invinc
    beq :+
    dec invinc
:   lda #0
    sta rc
@l: jsr robot_one
    inc rc
    lda rc
    cmp nrob
    bne @l
    lda #5              ; 赤いロボ
    sta rc
    jsr robot_one
    lda redsp           ; スクロールが止まったら、画面の下から赤いロボが1体登場する
    bne @r
    lda camlo
    ora camhi
    bne @r
    lda #11
    sta soff
    lda #5
    sta rc
    jsr spawn_robot
    lda #1
    sta redsp
@r: rts

; ロボ(rc番)を1体ぶん動かす
robot_one:
    ldx rc
    lda rst,x
    beq @wait
    lda rpl,x           ; 画面の下に流れたロボは待機に戻る
    sec
    sbc camlo
    sta u
    lda rph,x
    sbc camhi
    bmi @inscr
    bne @drop
    lda u
    cmp #208
    bcc @inscr
@drop:
    lda #0
    sta rst,x
    cpx #5
    bne :+
    sta redsp           ; 赤いロボは画面の外に出たら、また下から出し直す
    jmp @next
:   lda rrsp
    sta rtm,x
    jmp @next
@inscr:
    lda rst,x
    cmp #2
    beq @trap
    jsr robot_walk
    jmp @next
@wait:
    cpx #5              ; 赤いロボはここでは出さない
    beq @next
    lda camlo           ; スクロールが止まったあとは白いロボは出ない
    ora camhi
    bne :+
    sta rrun,x          ; (走っていたロボも消す)
    jmp @next
:   lda rrun,x
    bne @run
    lda fc
    and #1
    bne @next
    lda rtm,x
    cmp #52             ; 出る約1.7秒前になったら、横の余白を走り上がりはじめる
    bcc @startrun
    dec rtm,x
    jmp @next
@startrun:
    txa
    and #1
    clc
    adc #1              ; 1=左の余白 2=右の余白(ロボごとに交互)
    sta rrun,x
    lda #240            ; 画面の下から
    sta rly,x
    jmp @next
@run:
    lda rly,x           ; 1フレーム2pxで走り上がり、画面の上に着いたら迷路の上端に登場
    sec
    sbc #2
    sta rly,x
    cmp #35
    bcs @next
    lda #0
    sta rrun,x
    lda #1
    sta soff
    jsr spawn_robot
    jmp @next
@trap:
    lda fc
    and #1
    bne @next
    dec rtm,x
    bne @next
    lda #1              ; 這い出る
    sta rst,x
    sta rimm,x
    lda #0
    sta rmd,x
@next:
    jmp robot_hero

; 画面の上のほうの空いた部屋に出す(rc番)
; 出現位置(spx, syl/syh)が、いまいるロボと重なっていなければ C=1
spawn_free:
    ldx #5
@l: cpx rc
    beq @n
    lda rst,x
    beq @n
    lda rpx,x
    sec
    sbc spx
    bcs :+
    eor #$FF
    adc #1
:   cmp #16
    bcs @n
    lda rpl,x
    sec
    sbc syl
    sta stmp
    lda rph,x
    sbc syh
    beq @p
    cmp #$FF
    bne @n
    lda stmp
    cmp #241
    bcs @hit
    bcc @n
@p: lda stmp
    cmp #16
    bcc @hit
@n: dex
    bpl @l
    sec
    rts
@hit:
    clc
    rts

spawn_robot:
    lda soff
    cmp #1
    beq @top
    lda camlo           ; (赤いロボ) 画面の上端から soff 行下の奇数行
    lsr
    lsr
    lsr
    lsr
    sta u
    lda camhi
    asl
    asl
    asl
    asl
    ora u
    clc
    adc soff
    ora #1
    jmp @rowok
@top:                   ; 白いロボ: 画面に見えている一番上の行(上が欠けていない行)
    lda camlo
    clc
    adc #15
    sta u
    lda camhi
    adc #0
    sta stmp
    lda u
    lsr
    lsr
    lsr
    lsr
    sta u
    lda stmp
    asl
    asl
    asl
    asl
    ora u
@rowok:
    cmp #30
    bcc :+
    lda #29
:   sta dcy
    asl                 ; 行の世界y (下位・上位)
    asl
    asl
    asl
    sta syl
    lda dcy
    lsr
    lsr
    lsr
    lsr
    sta syh
    lda #13             ; 列をランダムに選び、壁か他のロボと重なる列は次の列へ
    sta md
    jsr rand
    jsr rmod
    sta scol
    lda #3              ; 主人公まで歩ける道がわかっているマスだけに出す。なければ1行ずつ下を探す
    sta srow
@rowtry:
    lda #13
    sta scnt
@try:
    lda scol
    asl
    asl
    asl
    asl
    clc
    adc #24
    sta spx
    ldy scol
    lda dcy
    jsr getcell
    cmp #1
    beq @bad
    lda dcy
    and #15
    asl
    asl
    asl
    asl
    ora scol
    tax
    lda dist,x
    and #$7F
    cmp #$7F
    beq @bad            ; 主人公へ行く道がまだわからない(外から切り離されたマス)
    jsr spawn_free
    bcs @ok
@bad:
    inc scol
    lda scol
    cmp #13
    bcc :+
    lda #0
    sta scol
:   dec scnt
    bne @try
    dec srow            ; この行に出せるマスがなければ、1行下で探す
    beq @nomore
    inc dcy
    lda dcy
    asl
    asl
    asl
    asl
    sta syl
    lda dcy
    lsr
    lsr
    lsr
    lsr
    sta syh
    jmp @rowtry
@nomore:
    lda scol            ; 空きが無いときは(まず起きない)奇数列に出す
    ora #1
    cmp #12
    bcc @ok
    lda #11
    sta scol
@ok:
    lda scol
    sta dcx
    ldx rc
    lda dcx
    asl
    asl
    asl
    asl
    clc
    adc #24
    sta rpx,x
    lda dcy
    asl
    asl
    asl
    asl
    sta rpl,x
    lda dcy
    lsr
    lsr
    lsr
    lsr
    sta rph,x
    lda #1
    sta rst,x
    lda #0
    sta rmd,x
    sta racc,x
    sta rimm,x
    sta rstp,x
    lda #SFX_SPAWN
    cpx #5
    bne :+
    lda #SFX_ALERT
:   sta sfx_req
    rts

; ロボのいるマスの値(rc番)
rcell:
    ldx rc
    lda rpl,x
    sta u
    lda rph,x
    sta v
    jsr tocell
    tax
    ldy rc
    lda rpx,y
    jmp mapat

robot_walk:
    ldx rc
    lda rspd
    cpx #5
    bne :+
    lda rspr            ; 赤いロボはもっと速い
:   clc
    adc racc,x
    sta racc,x
    bcs @go
    rts
@go:
    lda rpx,x
    and #15
    cmp #8
    bne @unal
    lda rpl,x
    and #15
    bne @unal
    ; --- マスの中心
    jsr rcell
    ldx rc
    cmp #2
    bne @nohole
    lda rimm,x
    bne @decide
    jsr hole_taken      ; すでに別のロボがはまっている穴には落ちない(1つの穴に1体まで)
    ldx rc
    bcs @decide
    lda #2              ; 穴に落ちる
    sta rst,x
    lda #TRAP_T
    sta rtm,x
    lda #0
    sta rstp,x
    sta rmd,x
    rts
@nohole:
    lda #0
    sta rimm,x
@decide:
    jsr robot_choose
    jmp @mv
@unal:
    lda #0
    sta rimm,x
@mv:
    ldx rc
    lda rmd,x
    beq @out
    lsr
    bcc :+
    inc rpx,x
    rts
:   lda rmd,x
    and #2
    beq :+
    dec rpx,x
    rts
:   lda rmd,x
    and #4
    beq :+
    inc rpl,x
    bne @out
    inc rph,x
    rts
:   lda rpl,x
    bne :+
    dec rph,x
:   dec rpl,x
@out:
    rts

; となりのマスのうち、主人公までの歩数が一番小さい方へ向く(rc番)
robot_choose:
    ldx rc
    lda rpx,x
    sec
    sbc #24
    lsr
    lsr
    lsr
    lsr
    sta gx
    lda rpl,x
    sta u
    lda rph,x
    sta v
    jsr tocell
    sta gy
    lda #$FF
    sta bd              ; これまでで一番小さい歩数
    lda #0
    sta cur             ; 選んだ向き
    sta kk
@k: ldx kk
    lda gx
    clc
    adc dxm,x
    sta nx
    lda gy
    clc
    adc dym,x
    sta ny
    sec
    sbc btop
    cmp #16
    bcs @skip
    lda ny
    ldy nx
    jsr getcell
    cmp #1
    beq @skip
    lda ny
    and #15
    asl
    asl
    asl
    asl
    ora nx
    tax
    lda dist,x
    and #$7F
    cmp bd
    bcs @skip
    sta bd
    ldx kk
    lda dbit,x
    sta cur
@skip:
    inc kk
    lda kk
    cmp #4
    bne @k
    lda bd
    cmp #$7F
    bcc :+
    lda #0              ; 行き先がわからなければ、あいている向きへ適当に進む(止まらない)
    sta cur
    lda fc
    lsr
    and #3
    sta kk
    lda #4
    sta fbn
@fb:ldx kk
    lda gx
    clc
    adc dxm,x
    sta nx
    lda gy
    clc
    adc dym,x
    sta ny
    sec
    sbc btop
    cmp #16
    bcs @fn
    lda ny
    ldy nx
    jsr getcell
    cmp #1
    beq @fn
    ldx kk
    lda dbit,x
    sta cur
    jmp :+
@fn:inc kk
    lda kk
    and #3
    sta kk
    dec fbn
    bne @fb
:   ldx rc
    lda cur
    sta rmd,x
    rts

; rc番のいるマスの穴に、別のロボがはまっていれば C=1
hole_taken:
    ldx #5
@l: cpx rc
    beq @n
    lda rst,x
    cmp #2
    bne @n
    ldy rc
    lda rpx,x
    cmp rpx,y
    bne @n
    lda rpl,x
    cmp rpl,y
    bne @n
    lda rph,x
    cmp rph,y
    bne @n
    sec
    rts
@n: dex
    bpl @l
    clc
    rts

dbit: .byte 1, 2, 4, 8

; ロボ(rc番)と主人公の当たり。さわったらミス、穴の中の頭は踏める(+200)
robot_hero:
    ldx rc
    lda rst,x
    beq @r
    cmp #2
    beq @trap
    lda invinc
    bne @r
    lda #12
    jsr near
    bcc @r
    jmp do_miss
@trap:
    lda rstp,x
    bne @r
    lda #8
    jsr near
    bcc @r
    ldx rc
    lda #1
    sta rstp,x
    lda #SFX_STOMP
    sta sfx_req
    lda #2
    jmp addscore
@r: rts

; ロボ(X番)と主人公のズレが、x・yとも A 未満ならC=1
near:
    sta u
    lda rpx,x
    sec
    sbc px
    bcs :+
    eor #$FF
    adc #1
:   cmp u
    bcs @no
    lda rpl,x
    sec
    sbc pylo
    sta v
    lda rph,x
    sbc pyhi
    beq @pos
    cmp #$FF
    bne @no
    lda v
    beq @no
    eor #$FF
    clc
    adc #1
    jmp @c
@pos:
    lda v
@c: cmp u
    bcs @no
    sec
    rts
@no:
    clc
    rts

; 主人公のいるマスに、穴にはまったロボがいたらC=1(頭の上は歩ける)
trapped_here:
    ldx #5
@t: lda rst,x
    cmp #2
    bne @n
    lda rpx,x
    cmp px
    bne @n
    lda rpl,x
    cmp pylo
    bne @n
    lda rph,x
    cmp pyhi
    bne @n
    sec
    rts
@n: dex
    bpl @t
    clc
    rts

; (dcx,dcy)の穴の中にいるロボをつぶす(+300)
crush_cell:
    lda dcx
    asl
    asl
    asl
    asl
    clc
    adc #24
    sta u               ; そのマスの中心x
    lda dcy
    asl
    asl
    asl
    asl
    sta v               ; y下位
    lda dcy
    lsr
    lsr
    lsr
    lsr
    sta tmp             ; y上位
    ldx #5
@c: lda rst,x
    cmp #2
    bne @n
    lda rpx,x
    cmp u
    bne @n
    lda rpl,x
    cmp v
    bne @n
    lda rph,x
    cmp tmp
    bne @n
    lda #0
    sta rst,x
    lda rrsp
    sta rtm,x
    stx hidx2
    lda #SFX_CRUSH
    sta sfx_req
    lda #3              ; 白いロボ +300
    cpx #5
    bne :+
    lda #10             ; 赤いロボ +1000
:   jsr addscore
    ldx hidx2
@n: dex
    bpl @c
    rts

; ---------------------------------------------------------------- 下辺・ミス
; マスの中心に止まっているとき、画面の下辺に触れていたら(下端が240pxを越える)1マス上へ押し上げる。
; 上が壁ならミス。
check_squeeze:
    lda px
    and #15
    cmp #8
    bne @no
    lda pylo
    and #15
    bne @no
    lda pylo
    sec
    sbc camlo
    sta u
    lda pyhi
    sbc camhi
    bne @no
    lda u
    cmp #193            ; 下辺(窓の下端)に触れた
    bcc @no
    lda #0
    sta mdir
    lda pad
    pha
    lda #8
    sta pad
    lda #8
    jsr try_dir         ; 上のマスが空いていれば1歩進んで mdir=8
    pla
    sta pad
    lda mdir
    bne @no
    jmp do_miss
@no:
    rts

; ミス: 残機を1つ減らす。0ならゲームオーバー。それ以外は画面の中ほどで復活し、2秒スクロールが止まる
do_miss:
    lda #SFX_MISS
    sta sfx_req
    dec lives
    bne @re
    lda #1
    sta gover
    jsr update_hi
    jmp bgm_stop
@re:
    lda #60             ; 1秒、正面を向いて倒れるアニメを見せてから復活する
    sta dying
    rts

; 復活: 画面の下のほうの部屋に戻す
revive:
    lda px
    sec
    sbc #24
    lsr
    lsr
    lsr
    lsr
    ora #1              ; 奇数列(部屋)にそろえる
    cmp #12
    bcc :+
    lda #11
:   asl
    asl
    asl
    asl
    clc
    adc #24
    sta px
    lda camlo
    lsr
    lsr
    lsr
    lsr
    sta u
    lda camhi
    asl
    asl
    asl
    asl
    ora u               ; 画面の一番上のマス行
    clc
    adc #7
    ora #1              ; 奇数行(部屋)にそろえる
    cmp #30
    bcc :+
    lda #29
:   sta u
    lsr
    lsr
    lsr
    lsr
    sta pyhi
    lda u
    asl
    asl
    asl
    asl
    sta pylo
    lda #0
    sta mdir
    sta turnt
    sta hstate
    sta digbuf
    sta ladbuf
    lda #PAUSE_FR
    sta campause
    lda #INVINC
    sta invinc
    ldx nrobm1          ; 復活した場所の近く(3マス以内)にいたロボだけ、いったん待機に戻る(3秒)
:   lda rst,x
    beq @nx
    lda #48
    jsr near
    bcc @nx
    lda #0
    sta rst,x
    lda #90
    sta rtm,x
@nx:dex
    bpl :-
    rts

; ---------------------------------------------------------------- 主人公
; マス単位で歩く(ブラウザ版と同じ)。マスの中心に来たときだけ向きを決め、
; 次のマスまで1フレーム1pxずつ進む。途中で逆向きを押すと即座に戻れる。
update_hero:
    lda pushtimer
    beq :+
    dec pushtimer
:   ; Aボタン(掘る/うめる)・Bボタン(ハシゴ)の押した瞬間を、それぞれ0.4秒ためておく
    lda digbuf
    beq :+
    dec digbuf
:   lda ladbuf
    beq :+
    dec ladbuf
:   lda pad
    and #$80            ; A
    bne :+
    sta digheld
    jmp @noa
:   lda digheld
    bne @noa
    lda #1
    sta digheld
    lda #24
    sta digbuf
@noa:
    lda pad
    and #$40            ; B
    bne :+
    sta ladheld
    jmp @nodig
:   lda ladheld
    bne @nodig
    lda #1
    sta ladheld
    lda #24
    sta ladbuf
@nodig:
    lda px
    and #15
    cmp #8              ; x座標はマス中心なら 24+16n → 下位4bitが8
    bne @tomid
    lda pylo
    and #15             ; y座標はマス中心なら 16n
    beq @center
@tomid:
    jmp @mid
@center:
    lda mdir            ; --- マスの中心(直前まで歩いていたか覚えておく)
    sta wasm
    lda #0
    sta mdir
    lda pylo            ; ゴールのマスなら ステージクリア
    sta u
    lda pyhi
    sta v
    jsr tocell
    tax
    lda px
    jsr mapat
    cmp #3
    bne @notgoal
    lda lives           ; ボーナス: 1000点 + 残機x500点
    asl
    asl
    clc
    adc lives
    clc
    adc #10
    sta bon
    jsr addscore
    lda golds           ; 金塊ぜんぶ(10個)でさらに3000点
    cmp #10
    bne :+
    lda #30
    jsr addscore
:   lda #1
    sta clear
    rts
@notgoal:
    lda pylo            ; 一番上へ1マス進むごとに10点
    sta u
    lda pyhi
    sta v
    jsr tocell
    cmp bestrow
    bcs @nobest
    sta bestrow
    jsr addten
@nobest:
    lda px              ; 金塊のマスなら取る(+300)
    sec
    sbc #24
    lsr
    lsr
    lsr
    lsr
    sta dcx
    lda pylo
    sta u
    lda pyhi
    sta v
    jsr tocell
    sta dcy
    tax
    lda px
    jsr mapat
    cmp #5
    bne @nogold
    lda #0
    sta sd
    ldy dcx
    lda dcy
    jsr setcell
    jsr qfloor
    inc golds
    lda #SFX_GOLD
    sta sfx_req
    lda #3
    jsr addscore
@nogold:
    lda swon            ; ストップウォッチ: スクロールが10秒止まる
    beq @nowatch
    lda dcx
    cmp swcx
    bne @nowatch
    lda dcy
    cmp swcy
    bne @nowatch
    lda #0
    sta swon
    lda #10
    sta freezes
    lda #60
    sta freezef
    lda #SFX_WATCH
    sta sfx_req
@nowatch:
    lda hstate          ; 穴に落ちている間は動けない(1秒で這い出る)
    cmp #1
    bne @notstuck
    dec fallt
    bne @stuckfin
    lda #2
    sta hstate
@stuckfin:
    jmp @fin
@notstuck:
    cmp #0              ; 穴のマスの中心に来たら落ちる
    bne @nofall
    lda pylo
    sta u
    lda pyhi
    sta v
    jsr tocell
    tax
    lda px
    jsr mapat
    cmp #2
    bne @nofall
    jsr trapped_here
    bcs @nofall
    lda #SFX_FALL
    sta sfx_req
    lda #1
    sta hstate
    lda #60
    sta fallt
    jmp @fin
@nofall:
    ; 向き(押している方向。壁に向かっても向きだけ変わる)
    lda face
    sta oldface
    lda pad
    and #$0F
    beq @nof
    lsr
    bcc :+
    lda #1
    sta face
    jmp @nof
:   lda pad
    and #2
    beq :+
    lda #2
    sta face
    jmp @nof
:   lda pad
    and #4
    beq :+
    lda #4
    sta face
    jmp @nof
:   lda #8
    sta face
@nof:
    lda pad             ; 止まっている状態から別の向きを押したら、まず向きだけ変える
    and #$0F
    beq @nt
    lda face
    cmp oldface
    beq @nt
    lda wasm            ; 歩いている途中の曲がり角ではそのまま曲がる(待たない)
    bne @nt
    lda #TURN_FR
    sta turnt
@nt:
    lda digbuf          ; ためてある掘る入力を、マスの中心でここに使う
    beq @nd
    lda #0
    sta digbuf
    jsr do_dig
@nd:
    lda ladbuf          ; ためてあるハシゴの入力
    beq @nl
    lda #0
    sta ladbuf
    jsr do_ladder
@nl:
    lda turnt           ; 向きを変えている間は歩かない(離したら向きだけ変えて終わり)
    beq @mv
    lda pad
    and #$0F
    bne :+
    sta turnt
    jmp @fin
:   dec turnt
    jmp @fin
@mv:
    lda #1              ; 向きを選ぶ
    jsr try_dir
    lda mdir
    bne @fin
    lda #2
    jsr try_dir
    lda mdir
    bne @fin
    lda #4
    jsr try_dir
    lda mdir
    bne @fin
    lda #8
    jsr try_dir
    lda mdir            ; 壁に向かって止まったなら、1.5秒のあいだハシゴをかけられる
    bne @fin
    lda pad
    and #$0F
    beq @fin
    lda #90
    sta pushtimer
    jmp @fin
@mid:                   ; --- マスの途中: 逆向きなら反転、そのまま進む
    lda hstate
    cmp #2
    bne :+
    lda #0
    sta hstate
:   lda mdir
    and #3
    beq @vert
    eor #3
    jmp @chk
@vert:
    lda mdir
    eor #12
@chk:
    sta tmp
    lda pad
    and tmp
    beq @cont
    lda tmp
    sta mdir
@cont:
    lda mdir
    jsr step_a
@fin:
    ; 見た目の向き
    lda mdir
    beq @idle
    sta face
    lsr
    bcc :+
    lda #2
    sta dir
    lda #0
    sta flip
    jmp @walk
:   lda mdir
    and #2
    beq :+
    lda #2
    sta dir
    lda #1
    sta flip
    jmp @walk
:   lda mdir
    and #4
    beq :+
    lda #0
    sta dir
    jmp @walk
:   lda #1
    sta dir
    jmp @walk
@idle:
    lda #0
    sta anim
    sta atimer
    lda face            ; 止まっているときは、向いている方向の絵
    lsr
    bcc :+
    lda #2
    sta dir
    lda #0
    sta flip
    rts
:   lda face
    and #2
    beq :+
    lda #2
    sta dir
    lda #1
    sta flip
    rts
:   lda face
    and #4
    beq :+
    lda #0
    sta dir
    rts
:   lda #1
    sta dir
    rts
@walk:
    inc atimer
    lda atimer
    cmp #8
    bcc @done
    lda #0
    sta atimer
    lda anim
    clc
    adc #1
    and #3
    sta anim
@done:
    rts

; A=向きのビット。押されていて、となりのマスが壁でなければ最初の1歩を進めて mdir に入れる
; (当たり判定は内側2px引きなので、3px先まで試してとなりのマスに掛かるか見る)
try_dir:
    sta sd
    lda pad
    and sd
    beq @no
    lda sd
    jsr step_a
    lda sd
    jsr step_a
    lda sd
    jsr step_a
    jsr blocked
    bcc @ok
    lda sd
    jsr unstep_a
    lda sd
    jsr unstep_a
    lda sd
    jsr unstep_a
    rts
@ok:
    lda sd
    jsr unstep_a
    lda sd
    jsr unstep_a
    lda sd
    sta mdir
@no:
    rts

step_a:                 ; A=向きのビット(1,2,4,8)の向きに1px
    lsr
    bcc @a
    inc px
    rts
@a: lsr
    bcc @b
    dec px
    rts
@b: lsr
    bcc @c
    inc pylo
    bne @e
    inc pyhi
@e: rts
@c: lda pylo
    bne @d
    dec pyhi
@d: dec pylo
    rts

unstep_a:               ; step_a の逆
    lsr
    bcc @a
    dec px
    rts
@a: lsr
    bcc @b
    inc px
    rts
@b: lsr
    bcc @c
    lda pylo
    bne @d
    dec pyhi
@d: dec pylo
    rts
@c: inc pylo
    bne @e
    inc pyhi
@e: rts

; ---------------------------------------------------------------- 表示
; A=世界座標y下位、X=上位 → A=画面のy(画面外なら $FF)
w2s:
    sta u
    stx v
    lda u
    sec
    sbc camlo
    sta u
    lda v
    sbc camhi
    bne @hide
    lda u
    cmp #208            ; 迷路窓(208px)の外は隠す
    bcs @hide
    clc
    adc #HUD_H          ; 表示帯の下から
    rts
@hide:
    lda #$FF
    rts

draw_all:
    ; 主人公(黄)
    lda px
    sta cx
    lda pylo
    ldx pyhi
    jsr w2s
    sta cy
    lda dying
    beq @alive
    lda #60             ; やられた: 正面を向いて倒れる(3コマ、20フレームずつ)
    sec
    sbc dying
    ldx #15
    cmp #20
    bcc :+
    inx
    cmp #40
    bcc :+
    inx
:   stx cfr
    lda #0
    sta cfl
    jmp @hdraw
@alive:
    lda hstate
    cmp #1
    bne @walking
    lda #1              ; 穴に落ちている: X目の頭だけ出して、8フレームごとに上下1pxずつ動かす
    sta chalf
    lda #15
    sta cfr
    lda #0
    sta cfl
    lda fc
    and #8
    beq @hbu
    inc cy
    jmp @hdraw
@hbu:
    dec cy
    jmp @hdraw
@walking:
    lda invinc
    and #4
    beq :+
    lda #$FF
    sta cy
:   lda dir
    cmp #2
    bne :+
    lda anim
    clc
    adc #2
    jmp :++
:   lda dir             ; 0=正面フレーム0, 1=背面フレーム1
:   sta cfr
    lda flip
    sta cfl
@hdraw:
    lda #1              ; スプライトパレット1=黄
    sta cat
    ldy #4              ; OAM 0〜3 はスプライト0
    jsr draw_char
    lda #0
    sta chalf
    ; ロボ(待機中は隠す)
    lda #0
    sta rc
@dr:
    ldx rc
    txa
    asl
    asl
    asl
    asl
    clc
    adc #20
    tay                 ; Y = このロボの OAM 位置
    lda rst,x
    bne @rshow
    lda rrun,x
    bne @runshow
    lda #$FF
    sta oam,y
    sta oam+4,y
    sta oam+8,y
    sta oam+12,y
    jmp @dn
@runshow:               ; 出る前: 横の余白を走り上がる(背面。足踏みで左右反転)
    cmp #2
    beq @rr
    lda #4
    bne @rx
@rr:lda #236
@rx:sta cx
    lda rly,x
    sta cy
    lda fc
    lsr
    lsr
    and #1
    sta cfl
    lda #0
    sta chalf
    sta cat
    lda #1
    sta cfr
    jmp @go
@rshow:
    lda rpx,x
    sta cx
    lda rpl,x
    pha
    lda rph,x
    tax
    pla
    jsr w2s
    sta cy
    ldx rc
    lda #0
    sta cfl
    sta chalf
    ldx rc
    cpx #5
    bne :+
    lda #2              ; 赤いロボはパレット2
:   sta cat
    lda rst,x
    cmp #2
    bne :+
    lda #1              ; 穴にはまっている: 頭だけ(8フレームごとに上下1pxずつ動かす)
    sta chalf
    lda fc
    and #8
    beq @bu
    inc cy
    jmp @bd
@bu:dec cy
@bd:lda #0
    sta cfr
    jmp @go
:   lda rmd,x
    lsr
    bcc :+
    lda fc              ; 右
    lsr
    lsr
    lsr
    and #3
    clc
    adc #2
    sta cfr
    jmp @go
:   lda rmd,x
    and #2
    beq :+
    lda #1              ; 左(右向きを反転)
    sta cfl
    lda fc
    lsr
    lsr
    lsr
    and #3
    clc
    adc #2
    sta cfr
    jmp @go
:   lda rmd,x
    and #8
    beq :+
    lda #1              ; 上=背面
    sta cfr
    jmp @go
:   lda #0              ; 下・止まり=正面
    sta cfr
@go:
    jsr draw_char
    lda #0
    sta chalf
@dn:
    inc rc
    lda rc
    cmp nrob
    beq @dred
    cmp #6
    beq @ddone
    jmp @dr
@dred:
    lda #5              ; 最後に赤いロボ
    sta rc
    jmp @dr
@ddone:
    ; GAME OVER
    lda gover
    beq @nogo
    jsr draw_gameover
@nogo:
    ldy #236            ; ストップウォッチ(取るまで)
    lda swon
    bne @wsh
    lda #$FF
    sta oam,y
    sta oam+4,y
    sta oam+8,y
    sta oam+12,y
    jmp @wd
@wsh:
    lda swcx
    asl
    asl
    asl
    asl
    clc
    adc #24
    sta cx
    lda swcy
    asl
    asl
    asl
    asl
    pha
    lda swcy
    lsr
    lsr
    lsr
    lsr
    tax
    pla
    jsr w2s
    sta cy
    lda #13             ; タイル52〜55
    sta cfr
    lda #0
    sta cfl
    sta chalf
    lda #3
    sta cat
    jsr draw_char
@wd:
    lda intro           ; ステージ開始の「STAGE x」
    beq @noin
    jsr draw_intro
@noin:
    rts

; ---------------------------------------------------------------- 黒いクリア画面
.macro PPUADDR row, col
    lda #>($2400 + (row) * 32 + (col))
    sta $2006
    lda #<($2400 + (row) * 32 + (col))
    sta $2006
.endmacro

.macro PUTS lbl
    lda #<lbl
    sta ptr
    lda #>lbl
    sta ptr+1
    jsr put_str
.endmacro

; ptr の文字(タイル番号。$FFで終わり)を PPU に続けて書く
put_str:
    ldy #0
:   lda (ptr),y
    cmp #$FF
    beq @d
    sta $2007
    iny
    bne :-
@d: rts

; A(0〜99) → X=十の位、A=一の位
div10:
    ldx #0
:   cmp #10
    bcc @d
    sbc #10
    inx
    bne :-
@d: rts

; ステージクリア(5面のあとは ALL CLEAR)の画面を画面B($2400)に作って出す
enter_clear:
    jsr update_hi
    lda #0
    sta $2001
    sta $2000
    sta hudflag
    sta pending
    jsr bgm_stop
    lda #SFX_CLEAR
    sta sfx_req
    ldx #0              ; スプライトは全部隠す
    lda #$FF
:   sta oam,x
    inx
    bne :-
    lda golds           ; 通しの金塊
    clc
    adc tgold
    sta tgold
    lda #0              ; 残機が回復するか(5面のあとは回復しない)
    sta healed
    lda stage
    cmp #STAGES
    bcs @nh
    lda lives
    cmp #LIVES0
    bcs @nh
    inc healed
@nh:
    lda $2002           ; 画面Bを黒で埋める(タイル20)
    lda #$24
    sta $2006
    lda #0
    sta $2006
    ldy #4
    ldx #0
    lda #HUDBLANK
:   sta $2007
    inx
    bne :-
    dey
    bne :-
    lda #$27            ; 属性(行ごとのパレット: 白・黄・点滅)
    sta $2006
    lda #$C0
    sta $2006
    ldx #0
:   lda resattr,x
    sta $2007
    inx
    cpx #64
    bne :-
    lda stage           ; --- 見出し
    cmp #STAGES
    bcc :+
    jmp @all
:   PPUADDR 4, 9
    PUTS s_stage
    lda stage
    clc
    adc #HUDD0
    sta $2007
    PUTS s_clr
    PPUADDR 8, 8       ; --- ボーナス
    PUTS s_bonus
    lda bon             ; 15/20/25 → 1500/2000/2500
    jsr div10
    pha
    txa
    clc
    adc #HUDD0
    sta $2007
    pla
    clc
    adc #HUDD0
    sta $2007
    lda #HUDD0
    sta $2007
    sta $2007
    PPUADDR 10, 8      ; --- 金塊
    PUTS s_gold
    lda golds
    jsr div10
    jsr put_two
    PUTS s_of10
    jmp @perf
@all:
    PPUADDR 4, 11
    PUTS s_allclr
    PPUADDR 6, 13      ; --- ランク(30000 S / 22000 A / 16000 B / それ未満 C)
    PUTS s_rank
    lda dg
    cmp #3
    bcs @rs
    cmp #2
    bcs @r2
    cmp #1
    bcc @rc
    lda dg+1            ; 1xxxx
    cmp #6
    bcs @rb
    jmp @rc
@r2:lda dg+1            ; 2xxxx
    cmp #2
    bcs @ra
    jmp @rb
@rs:lda #52 + 'S' - 'A'
    bne @rw
@ra:lda #52
    bne @rw
@rb:lda #53
    bne @rw
@rc:lda #54
@rw:sta $2007
    PPUADDR 10, 8      ; --- 金塊の合計
    PUTS s_gold
    lda tgold
    jsr div10
    jsr put_two
    PUTS s_of50
@perf:
    lda golds           ; --- PERFECT!
    cmp #10
    bne @np
    PPUADDR 12, 9
    PUTS s_perf
@np:
    lda healed          ; --- 残機の回復
    beq @nr
    PPUADDR 14, 8
    PUTS s_heal
@nr:
    PPUADDR 18, 8      ; --- スコア
    PUTS s_score
    ldx #0
:   lda dg,x
    clc
    adc #HUDD0
    sta $2007
    inx
    cpx #5
    bne :-
    PPUADDR 24, 11     ; --- PUSH START(点滅)
    PUTS s_push
    lda #$30
    sta pcol
    lda #0
    sta cblink
    lda #1
    sta cscr
    lda #$89
    sta ctrl
    bit $2002
:   bit $2002
    bpl :-
    lda ctrl
    sta $2000
    lda #%00011110
    sta $2001
    lda #0
    sta nmiflag
    rts

; X=十の位、A=一の位 を2桁で書く(十の位が0なら黒)
put_two:
    pha
    cpx #0
    bne @nz
    lda #HUDBLANK
    bne @w
@nz:txa
    clc
    adc #HUDD0
@w: sta $2007
    pla
    clc
    adc #HUDD0
    sta $2007
    rts

; クリア画面の演出(スプライト)。ステージクリア: 黄色いロボが画面の左から右へ歩いて抜ける(くり返し)
; ALL CLEAR: 真ん中で正面を向いて飛び跳ねる
draw_cscene:
    lda stage
    cmp #STAGES
    bcs @all
    lda cblink          ; 1フレーム1px。画面の右端(241〜)では隠して、また左から
    cmp #241
    bcc @wv
    lda #$FF
    sta cy
    bne @dr
@wv:sta cx
    lsr
    lsr
    lsr
    and #3
    clc
    adc #2              ; 横向きの歩きのコマ(2〜5)
    sta cfr
    lda #160
    sta cy
    lda #0
    sta cfl
    beq @dr
@all:
    lda cblink
    and #31
    tay
    lda #124
    sec
    sbc jumptab,y
    sta cy
    lda #120
    sta cx
    lda #0
    sta cfr
    sta cfl
@dr:lda #0
    sta chalf
    lda #1              ; 主人公(黄)
    sta cat
    ldy #4
    jmp draw_char

jumptab:                ; 飛び跳ねの高さ(32フレームで1回。最大16px)
    .byte 0,1,3,5,7,8,9,10,12,12,13,14,15,15,15,15,16,15,15,15,15,14,13,12,12,10,9,8,7,5,3,1

; 16x16キャラを4スプライトで描く。Y=OAMオフセット(呼ぶたび16進む)。cy=$FFなら隠す
draw_char:
    lda cy
    cmp #$F0
    bcc @show
    lda #$FF
    sta oam,y
    sta oam+4,y
    sta oam+8,y
    sta oam+12,y
    tya
    clc
    adc #16
    tay
    rts
@show:
    lda cfr
    asl
    asl
    sta tb
    lda cfl
    bne @fl
    lda tb
    sta t0
    clc
    adc #1
    sta t1
    adc #1
    sta t2
    adc #1
    sta t3
    lda cat
    sta at
    jmp @out
@fl:
    lda tb
    sta t1
    clc
    adc #1
    sta t0
    adc #1
    sta t3
    adc #1
    sta t2
    lda cat
    ora #$40
    sta at
@out:
    lda cy
    sec
    sbc #1
    sta tmp
    ; 左上
    sta oam,y
    iny
    lda t0
    sta oam,y
    iny
    lda at
    sta oam,y
    iny
    lda cx
    sta oam,y
    iny
    ; 右上
    lda tmp
    sta oam,y
    iny
    lda t1
    sta oam,y
    iny
    lda at
    sta oam,y
    iny
    lda cx
    clc
    adc #8
    sta oam,y
    iny
    ; 左下
    lda tmp
    clc
    adc #8
    sta oam,y
    iny
    lda t2
    sta oam,y
    iny
    lda at
    sta oam,y
    iny
    lda cx
    sta oam,y
    iny
    ; 右下
    lda tmp
    clc
    adc #8
    sta oam,y
    iny
    lda t3
    sta oam,y
    iny
    lda at
    sta oam,y
    iny
    lda cx
    clc
    adc #8
    sta oam,y
    iny
    lda chalf
    beq :+
    lda #$FF
    sta oam-8,y         ; 下の2つ(左下・右下)を隠す
    sta oam-4,y
:   rts

.segment "RODATA"
palette:
    ; 背景0: 床(緑)・こい緑・茶・うす橙
    ; 1=表示帯・クリア画面(黒地に白) 2=点滅(色2をNMIで切り替え) 3=黄(色3=赤は、タイトルの大きな文字の影)
    .byte $29,$09,$17,$27,  $29,$0F,$30,$28,  $29,$0F,$30,$0F,  $29,$0F,$28,$16
    ; スプライト0=白 1=黄 2=赤 3=文字(黒い四角に白)・ストップウォッチ
    .byte $29,$01,$30,$21,  $29,$01,$38,$27,  $29,$01,$16,$27,  $29,$0F,$30,$21
padtab:                         ; 黒い四角だけの行(文字の上下の余白)
    .byte $FF,$FF,$FF,$FF,$FF,$FF,$FF,$FF
txt_stage:
    .byte 33,35,25,24,27,$FF  ; S T A G E _
goover1:
    .byte $FF,24,25,26,27,$FF ; _ G A M E _
goover2:
    .byte $FF,28,29,27,30,$FF ; _ O V E R _
titlepic:
    .incbin "../assets/titlepic.bin"
titlebar:
    .incbin "../assets/titlebar.bin"
hudnt:
    .incbin "../assets/hud.bin"
colcell:
    .incbin "../assets/colcell.bin"
rowlo:
    .incbin "../assets/rowlo.bin"
rowhi:
    .incbin "../assets/rowhi.bin"

resattr:
    .incbin "../assets/resattr.bin"

; クリア画面の文字(背景タイル: A〜Z=52〜77, !=78, +=79, /=80, 数字=22〜31, 空白=20(黒))
.charmap 32, 20
.charmap 65, 52
.charmap 66, 53
.charmap 67, 54
.charmap 68, 55
.charmap 69, 56
.charmap 70, 57
.charmap 71, 58
.charmap 72, 59
.charmap 73, 60
.charmap 74, 61
.charmap 75, 62
.charmap 76, 63
.charmap 77, 64
.charmap 78, 65
.charmap 79, 66
.charmap 80, 67
.charmap 81, 68
.charmap 82, 69
.charmap 83, 70
.charmap 84, 71
.charmap 85, 72
.charmap 86, 73
.charmap 87, 74
.charmap 88, 75
.charmap 89, 76
.charmap 90, 77
.charmap 48, 22
.charmap 49, 23
.charmap 50, 24
.charmap 51, 25
.charmap 52, 26
.charmap 53, 27
.charmap 54, 28
.charmap 55, 29
.charmap 56, 30
.charmap 57, 31
.charmap 33, 78
.charmap 43, 79
.charmap 47, 80
s_stage:  .byte "STAGE ", $FF
s_clr:    .byte " CLEAR!", $FF
s_allclr: .byte "ALL CLEAR!", $FF
s_rank:   .byte "RANK ", $FF
s_bonus:  .byte "BONUS  +", $FF
s_gold:   .byte "GOLD    ", $FF
s_of10:   .byte "/10", $FF
s_of50:   .byte "/50", $FF
s_perf:   .byte "PERFECT! +3000", $FF
s_heal:   .byte "LIFE RECOVER +1", $FF
s_score:  .byte "SCORE   ", $FF
s_push:   .byte "PUSH START", $FF

.include "../assets/sound.inc"

.segment "SAVE"
sv_magic: .res 2        ; 'H' 'R'
sv_hs:    .res 5        ; ハイスコア
sv_sum:   .res 1        ; 検査値

.segment "VECTORS"
    .word nmi, reset, irq

.segment "CHARS"
    .incbin "../assets/chr.bin"
