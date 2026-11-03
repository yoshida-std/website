; ホリホリ・ロボバスター ファミコン版 — 第1段階: キャラを表示して十字キーで歩かせる
.setcpu "6502"

.segment "HEADER"
    .byte "NES", $1A
    .byte 2             ; PRG 16KB x2
    .byte 1             ; CHR 8KB x1
    .byte 0, 0          ; 横ミラー(縦スクロール用)、マッパー0

.segment "ZEROPAGE"
pad:    .res 1
px:     .res 1
py:     .res 1
dir:    .res 1          ; 0=下 1=上 2=横
flip:   .res 1          ; 1=左向き(横反転)
anim:   .res 1
atimer: .res 1
moving: .res 1
nmiflag:.res 1
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
mdir:   .res 1          ; 移動中の向き(1=右 2=左 4=下 8=上、0=止まり)。パッドのビットと同じ
sd:     .res 1
bx0:    .res 1
bx1:    .res 1
by0:    .res 1
by1:    .res 1

.segment "OAM"
oam:    .res 256

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

    ; ネームテーブル0 (地形)
    lda $2002
    lda #$20
    sta $2006
    lda #$00
    sta $2006
    lda #<nametable
    sta tmp
    ; 1024バイトを $2007 へ
    ldy #0
    ldx #4
    lda #<nametable
    sta $00
    lda #>nametable
    sta $01
:   lda ($00),y
    sta $2007
    iny
    bne :-
    inc $01
    dex
    bne :-

    ; 初期位置
    lda #40
    sta px
    lda #16
    sta py
    lda #0
    sta dir
    sta flip

    lda #%10001000      ; NMI有効、スプライト=$1000
    sta $2000
    lda #%00011110
    sta $2001

main:
    lda nmiflag
    beq main
    lda #0
    sta nmiflag

    jsr read_pad
    jsr update_hero
    jsr draw_all
    jmp main

nmi:
    pha
    txa
    pha
    tya
    pha
    lda #0
    sta $2003
    lda #>oam
    sta $4014
    lda #0
    sta $2005
    sta $2005
    lda #%10001000
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

.macro CHKPT xv, yv
    lda xv
    sec
    sbc #24             ; 迷路の左端(3タイル=24px)
    lsr
    lsr
    lsr
    lsr
    sta tmp
    lda yv
    and #$F0
    ora tmp
    tax
    lda map,x
    bne @yes
.endmacro

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
    lda py
    clc
    adc #2
    sta by0
    lda py
    clc
    adc #13
    sta by1
    CHKPT bx0, by0
    CHKPT bx1, by0
    CHKPT bx0, by1
    CHKPT bx1, by1
    clc
    rts
@yes:
    sec
    rts

; マス単位で歩く(ブラウザ版と同じ)。マスの中心に来たときだけ向きを決め、
; 次のマスまで1フレーム1pxずつ進む。途中で逆向きを押すと即座に戻れる。
update_hero:
    lda px
    and #15
    cmp #8              ; x座標はマス中心なら 24+16n → 下位4bitが8
    bne @mid
    lda py
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
    inc py
    rts
@c: dec py
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
    dec py
    rts
@c: inc py
    rts

draw_all:
    ; 主人公(黄)
    lda px
    sta cx
    lda py
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
    ; 白いロボ(止まり絵)
    lda #104
    sta cx
    lda #79
    sta cy
    lda #0
    sta cfr
    sta cfl
    sta cat             ; パレット0=白
    jsr draw_char
    ; 赤いロボ(止まり絵・左向き)
    lda #168
    sta cx
    lda #143
    sta cy
    lda #2
    sta cfr
    lda #1
    sta cfl
    lda #2              ; パレット2=赤
    sta cat
    jsr draw_char
    rts

; 16x16キャラを4スプライトで描く。Y=OAMオフセット(呼ぶたび16進む)
draw_char:
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
map:
    .incbin "../assets/map.bin"
nametable:
    .incbin "../assets/nametable.bin", 0, 1024

.segment "VECTORS"
    .word nmi, reset, irq

.segment "CHARS"
    .incbin "../assets/chr.bin"
