; ホリホリ・ロボバスター ファミコン版
; 第4段階: 縦長の迷路(31行)を強制スクロールで下から上へ。画面に出る行だけ背景に書く。
.setcpu "6502"

ROWS      = 31          ; 迷路の行数(1行=16px)
START_CAM = 256         ; 開始時のカメラ(世界座標で画面の一番上のy) = 31*16-240
NROBMAX   = 5           ; ロボの最大数(ステージ5で5体)
STAGES    = 5
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
    .byte 0, 0          ; 横ミラー(上下2面=縦スクロール用)、マッパー0

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
face:   .res 1          ; 向いている方向(1=右 2=左 4=下 8=上)
digbuf: .res 1          ; 掘るボタンの入力をためておく(フレーム)
digheld:.res 1
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
rowbuf: .res 32
mapram: .res 512        ; 迷路(1行16バイト x 31行。1=壁)
bq:
sx:     .res 96         ; 迷路生成のスタック(部屋のx)。ゲーム中は距離マップのキューに使い回す
sy:     .res 96
cand:   .res 4
dist:   .res 256        ; 主人公までの歩数。(行&15)*16+列。bit7=世代、下位7bit=歩数
rpx:    .res 5          ; ロボ: x
rpl:    .res 5          ; y下位
rph:    .res 5          ; y上位
rmd:    .res 5          ; 進む向き(1=右 2=左 4=下 8=上、0=止まり)
rst:    .res 5          ; 0=待機中 1=歩く 2=穴にはまっている
rtm:    .res 5          ; 待機・這い出るまでの残り(2フレーム単位)
racc:   .res 5          ; 速さの小数
rimm:   .res 5          ; 1=這い出た直後(その穴では落ちない)
rstp:   .res 5          ; 1=頭を踏まれた
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

    ; 背景(ネームテーブル)をゼロで埋める
    lda $2002
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

    ; タイトル画面
    lda #1
    sta title
    sta seed
    lda #$88
    sta ctrl
    sta $2000
    lda #%00011110
    sta $2001

main:
    lda nmiflag
    beq main
    lda #0
    sta nmiflag

    jsr read_pad
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
:   lda #<txt_push1
    sta tp
    lda #>txt_push1
    sta tp+1
    lda #4
    sta tn
    lda #112
    sta cx
    lda #104
    sta cy
    lda #112
    sta to
    jsr draw_text
    lda #<txt_push2
    sta tp
    lda #>txt_push2
    sta tp+1
    lda #5
    sta tn
    lda #108
    sta cx
    lda #120
    sta cy
    lda #132
    sta to
    jsr draw_text
    jmp main
@clear:
    lda pad
    and #$10            ; Start で次のステージ(5面のあとは最初から)
    beq :+
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

; 最初から(1面・残機・スコアを戻して開始)
newgame:
    lda #1
    sta stage
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
    sta hstate
    sta digbuf
    sta digheld
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
    ldx stage           ; このステージの速さなど(表は0始まり)
    dex
    lda stg_cam,x
    sta camspd
    lda stg_rspd,x
    sta rspd
    lda stg_resp,x
    sta rrsp
    lda stage           ; ロボの数 = ステージ番号
    sta nrob
    sec
    sbc #1
    sta nrobm1
    ldx #NROBMAX-1      ; ロボは待機から(2秒+1.4秒ずつずらして出る)
:   lda #0
    sta rst,x
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
    jsr gen_maze
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
    beq @sp
    sta oam+1,x
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
@sp:inx
    inx
    inx
    inx
    iny
    cpy tn
    bne @l
    rts

nmi:
    pha
    txa
    pha
    tya
    pha
    lda pending
    beq :+
    jsr write_row
    lda #0
    sta pending
:   lda #2              ; 穴の絵の書き換え(1フレームに2マスまで)
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
    lda #0
    sta $2005
    lda scrl
    sta $2005
    lda ctrl
    sta $2000
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

; カメラ(世界座標y)→ PPUのスクロールYとネームテーブル選択。輪は 480px(上下2面)
set_scroll:
    lda camhi
    bne @lower
    lda camlo
    cmp #240
    bcs @lower
    sta scrl
    lda #$88            ; NMI有効、スプライト=$1000
    sta ctrl
    rts
@lower:
    lda camlo
    sec
    sbc #240
    sta scrl
    lda #$8A            ; ネームテーブル選択=下の面
    sta ctrl
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
    cmp #3
    beq @gl
    lda #2              ; 壁
    bne @st
@gl:lda #11             ; ゴール
    bne @st
@fl:lda #1              ; 床
@st:sta rowbuf,x
    inx
    cpx #32
    bne @l
    lda rr
    cmp #30
    bcc @k
    sbc #30
@k: tay
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
@b: lda rowbuf,x
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
do_dig:
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
    bcs @no
    lda dcy
    cmp #31
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
    lda dcy             ; 輪の中の行 = 行 mod 30
    cmp #30
    bcc :+
    sbc #30
:   tay
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
@a: lda dg+2
    cmp #10
    bcc @b
    sbc #10
    sta dg+2
    inc dg+1
    jmp @a
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
@r: ldx rc
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
    cmp #240
    bcc @inscr
@drop:
    lda #0
    sta rst,x
    lda rrsp
    sta rtm,x
    jmp @next
@inscr:
    lda rst,x
    cmp #2
    beq @trap
    jsr robot_walk
    jmp @next
@wait:
    lda fc
    and #1
    bne @next
    lda rtm,x
    beq @spawn
    dec rtm,x
    jmp @next
@spawn:
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
    jsr robot_hero
    inc rc
    lda rc
    cmp nrob
    bne @r
    rts

; 画面の上のほうの空いた部屋に出す(rc番)
spawn_robot:
    lda #6
    sta md
    jsr rand
    jsr rmod
    asl
    clc
    adc #1
    sta dcx             ; 奇数列 1〜11
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
    clc
    adc #1
    ora #1              ; 画面の上端の少し下の奇数行
    cmp #30
    bcc :+
    lda #29
:   sta dcy
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
    lda racc,x
    clc
    adc rspd
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
    lda #0              ; 行き先がわからなければ止まる
    sta cur
:   ldx rc
    lda cur
    sta rmd,x
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
    ldx nrobm1
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
    ldx nrobm1
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
    lda #3
    jsr addscore
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
    cmp #225
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
    dec lives
    bne @re
    lda #1
    sta gover
    rts
@re:
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
    sta hstate
    sta digbuf
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
    ; 掘るボタン(A/B)の押した瞬間を 0.4秒ためておく
    lda digbuf
    beq :+
    dec digbuf
:   lda pad
    and #$C0
    bne :+
    sta digheld
    jmp @nodig
:   lda digheld
    bne @nodig
    lda #1
    sta digheld
    lda #24
    sta digbuf
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
    lda #0              ; --- マスの中心
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
    jsr addscore
    lda #1
    sta clear
    rts
@notgoal:
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
    lda #1
    sta hstate
    lda #60
    sta fallt
    jmp @fin
@nofall:
    ; 向き(押している方向。壁に向かっても向きだけ変わる)
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
    lda digbuf          ; ためてある掘る入力を、マスの中心でここに使う
    beq @nd
    lda #0
    sta digbuf
    jsr do_dig
@nd:
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
    cmp #240
    bcs @hide
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
    lda #1              ; スプライトパレット1=黄
    sta cat
    ldy #0
    jsr draw_char
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
    adc #16
    tay                 ; Y = このロボの OAM 位置
    lda rst,x
    bne @rshow
    lda #$FF
    sta oam,y
    sta oam+4,y
    sta oam+8,y
    sta oam+12,y
    jmp @dn
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
    sta cat             ; パレット0=白
    lda rst,x
    cmp #2
    bne :+
    lda #1              ; 穴にはまっている: 頭だけ
    sta chalf
    lda #0
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
    beq :+
    jmp @dr
:
    ; 残機(左上に縦3つ。主人公の頭のタイル)
    ldy #96
    ldx #1
@lv:
    stx tmp
    lda lives
    cmp tmp
    bcs @show
    lda #$FF
    sta oam,y
    jmp @nx
@show:
    txa
    asl
    asl
    asl
    sec
    sbc #1
    sta oam,y           ; y = 8*番号 - 1
    lda #0
    sta oam+1,y
    lda #1
    sta oam+2,y
    lda #8
    sta oam+3,y
@nx:
    iny
    iny
    iny
    iny
    inx
    cpx #4
    bne @lv
    ; GAME OVER
    lda gover
    beq @nogo
    lda #<goover1
    sta tp
    lda #>goover1
    sta tp+1
    lda #4
    sta tn
    lda #112
    sta cx
    lda #104
    sta cy
    lda #112
    sta to
    jsr draw_text
    lda #<goover2
    sta tp
    lda #>goover2
    sta tp+1
    lda #112
    sta cx
    lda #120
    sta cy
    lda #132
    sta to
    jsr draw_text
@nogo:
    ldx #0              ; スコア: 左の余白に縦に5桁(OAM 152〜)
    ldy #152
@sc:
    txa
    asl
    asl
    asl
    clc
    adc #47
    sta oam,y           ; y = 48 + 8*桁 - 1
    lda dg,x
    clc
    adc #36
    sta oam+1,y
    lda #3
    sta oam+2,y
    lda #8
    sta oam+3,y
    iny
    iny
    iny
    iny
    inx
    cpx #5
    bne @sc
    lda #103            ; ステージ番号(スコアの下)
    sta oam,y
    lda stage
    clc
    adc #36
    sta oam+1,y
    lda #3
    sta oam+2,y
    lda #8
    sta oam+3,y
    ; ステージクリア
    lda clear
    beq @nocl
    lda stage
    cmp #STAGES
    bcs @all
    lda #<clr1          ; STAGE
    sta tp
    lda #>clr1
    sta tp+1
    lda #5
    sta tn
    lda #108
    sta cx
    jmp @cl2
@all:
    lda #<all1          ; ALL
    sta tp
    lda #>all1
    sta tp+1
    lda #3
    sta tn
    lda #116
    sta cx
@cl2:
    lda #104
    sta cy
    lda #112
    sta to
    jsr draw_text
    lda #<clr2          ; CLEAR
    sta tp
    lda #>clr2
    sta tp+1
    lda #5
    sta tn
    lda #108
    sta cx
    lda #120
    sta cy
    lda #132
    sta to
    jsr draw_text
@nocl:
    rts

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
    ; 背景: 床(緑)・こい緑・茶・うす橙
    .byte $29,$09,$17,$27,  $29,$09,$17,$27,  $29,$09,$17,$27,  $29,$09,$17,$27
    ; スプライト0=白 1=黄 2=赤 3=予備(ふち,からだ,アクセント)
    .byte $29,$01,$30,$21,  $29,$01,$38,$27,  $29,$01,$16,$27,  $29,$01,$30,$21
clr1:
    .byte 33,35,25,24,27      ; S T A G E
clr2:
    .byte 46,47,27,25,30      ; C L E A R
all1:
    .byte 25,47,47            ; A L L
goover1:
    .byte 24,25,26,27         ; G A M E
goover2:
    .byte 28,29,27,30         ; O V E R
txt_push1:
    .byte 31,32,33,34         ; P U S H
txt_push2:
    .byte 33,35,25,30,35      ; S T A R T
colcell:
    .incbin "../assets/colcell.bin"
rowlo:
    .incbin "../assets/rowlo.bin"
rowhi:
    .incbin "../assets/rowhi.bin"

.segment "VECTORS"
    .word nmi, reset, irq

.segment "CHARS"
    .incbin "../assets/chr.bin"
