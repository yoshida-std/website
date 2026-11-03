; ホリホリ・ロボバスター ファミコン版
; 第4段階: 縦長の迷路(31行)を強制スクロールで下から上へ。画面に出る行だけ背景に書く。
.setcpu "6502"

ROWS      = 31          ; 迷路の行数(1行=16px)
START_CAM = 256         ; 開始時のカメラ(世界座標で画面の一番上のy) = 31*16-240
.ifndef LIVES0
LIVES0    = 3           ; 最初の残機(ミスは3回まで)
.endif
PAUSE_FR  = 120         ; 復活後にスクロールが止まるフレーム数(2秒)
CAM_SPEED = 61          ; 1フレームに上へ進む量(1/256px単位)。61/256*60 ≒ 14.3px/秒 ≒ 0.9マス/秒

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

.segment "OAM"
oam:    .res 256

.segment "BSS"
rowbuf: .res 32

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

    ; 初期状態
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
    lda #LIVES0
    sta lives

    ; 画面に最初から出る行(マス行16〜30)を背景に書いておく(描画オフのうちに)
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

    lda $2002
    lda ctrl
    sta $2000
    lda #%00011110
    sta $2001

main:
    lda nmiflag
    beq main
    lda #0
    sta nmiflag

    jsr read_pad
    lda gover
    bne @over
    jsr update_hero
    jsr check_squeeze
    jsr update_cam
    jsr draw_all
    jmp main
@over:
    lda pad
    and #$10            ; Start でやり直し(最初から)
    beq :+
    jmp reset
:   jsr draw_all
    jmp main

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
:   lda #0
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
    sbc #CAM_SPEED
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
    adc #<map
    sta ptr
    lda ptr+1
    adc #>map
    sta ptr+1
    ldx #0
@l: ldy colcell,x
    cpy #$FF
    beq @fl
    lda (ptr),y
    beq @fl
    lda #2              ; 壁
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
    adc #<map
    sta ptr
    lda ptr+1
    adc #>map
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
    bne @yes
    lda bx1
    ldx cya
    jsr mapat
    bne @yes
    lda bx0
    ldx cyb
    jsr mapat
    bne @yes
    lda bx1
    ldx cyb
    jsr mapat
    bne @yes
    clc
    rts
@yes:
    sec
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
    lda #PAUSE_FR
    sta campause
    rts

; ---------------------------------------------------------------- 主人公
; マス単位で歩く(ブラウザ版と同じ)。マスの中心に来たときだけ向きを決め、
; 次のマスまで1フレーム1pxずつ進む。途中で逆向きを押すと即座に戻れる。
update_hero:
    lda px
    and #15
    cmp #8              ; x座標はマス中心なら 24+16n → 下位4bitが8
    bne @mid
    lda pylo
    and #15             ; y座標はマス中心なら 16n
    bne @mid
    lda #0              ; --- マスの中心: 向きを選ぶ
    sta mdir
    lda #1
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
    lda mdir
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
    lda dir
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
    ; 白いロボ(止まり絵。マス(5,27))
    lda #104
    sta cx
    lda #<432
    ldx #>432
    jsr w2s
    sta cy
    lda #0
    sta cfr
    sta cfl
    sta cat             ; パレット0=白
    jsr draw_char
    ; 赤いロボ(止まり絵・左向き。マス(9,23))
    lda #168
    sta cx
    lda #<368
    ldx #>368
    jsr w2s
    sta cy
    lda #2
    sta cfr
    lda #1
    sta cfl
    lda #2              ; パレット2=赤
    sta cat
    jsr draw_char
    ; 残機(左上に縦3つ。主人公の頭のタイル)
    ldy #48
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
    ldx #0
    ldy #64
@go:
    lda goover,x
    cmp #$FF
    beq @sp
    sta oam+1,y
    lda #111
    sta oam,y
    lda #3
    sta oam+2,y
    txa
    asl
    asl
    asl
    clc
    adc #88
    sta oam+3,y
@sp:
    iny
    iny
    iny
    iny
    inx
    cpx #9
    bne @go
@nogo:
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
    rts

.segment "RODATA"
palette:
    ; 背景: 床(緑)・こい緑・茶・うす橙
    .byte $29,$19,$17,$27,  $29,$19,$17,$27,  $29,$19,$17,$27,  $29,$19,$17,$27
    ; スプライト0=白 1=黄 2=赤 3=予備(ふち,からだ,アクセント)
    .byte $29,$01,$30,$21,  $29,$01,$38,$27,  $29,$01,$16,$27,  $29,$01,$30,$21
goover:
    .byte 24,25,26,27,$FF,28,29,27,30   ; G A M E _ O V E R
map:
    .incbin "../assets/map.bin"
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
