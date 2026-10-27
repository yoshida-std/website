# 隠れキャラ「あいつ」: ユーザーの線画（src/aitsu_0.png, aitsu_1.png、左向き）を 32x32（表示の大きさ、s=1）の白黒ドットにして sprites.png に足す
# python3 games/Susume-Yusha/tools/art/aitsu.py のあと node games/Susume-Yusha/tools/export-sprites.js --from-sheet
import sys,os,json
from PIL import Image, ImageOps
import numpy as np
from collections import deque
def load(src):
    im=Image.open(src).convert('RGBA');bg=Image.new('RGBA',im.size,(255,255,255,255));bg.alpha_composite(im)
    a=np.array(bg.convert('L'));H,W=a.shape;dark=a<128
    out=np.zeros((H,W),bool);q=deque([(0,x) for x in range(W)]+[(H-1,x) for x in range(W)]+[(y,0) for y in range(H)]+[(y,W-1) for y in range(H)])
    while q:
        y,x=q.popleft()
        if y<0 or x<0 or y>=H or x>=W or out[y,x] or dark[y,x]:continue
        out[y,x]=True;q.extend([(y+1,x),(y-1,x),(y,x+1),(y,x-1)])
    L=np.where(dark,0,255).astype('uint8');A=np.where(out,0,255).astype('uint8')
    img=Image.merge('LA',(Image.fromarray(L),Image.fromarray(A)));img=ImageOps.mirror(img)
    return img.crop(img.getbbox())

HERE=os.path.dirname(os.path.abspath(__file__));D=os.path.join(HERE,'..','..')+'/'
fr=[load(os.path.join(HERE,'src',f'aitsu_{i}.png')) for i in (0,1)]
sc=30/max(f.height for f in fr);res=[]
for f in fr:
    w,h=round(f.width*sc),round(f.height*sc)
    l,a=[c.resize((w,h),Image.BOX) for c in f.split()]
    l=np.array(l);a=np.array(a)
    rgba=np.zeros((h,w,4),'uint8')
    rgba[...,:3]=np.where((l<200)[...,None],[28,22,26],[252,252,248]);rgba[...,3]=np.where(a>100,255,0)
    c=Image.new('RGBA',(32,32));c.alpha_composite(Image.fromarray(rgba,'RGBA'),((32-w)//2,32-h));res.append(c)
# 目は縮めるとつぶれるので描きなおす（ねむそうな目: 上半分がまぶた、下に黒目）
EYE=['.###.','#####','#o#o#','.###.']
K=(28,22,26,255);Wc=(252,252,248,255)
edges={0:[(8,23),(8,24),(7,24),(7,25),(7,25)],1:[(7,23),(7,23),(7,24),(7,24),(7,24)]}
for i,im in enumerate(res):
    p=im.load()
    for r,(l,rt) in enumerate(edges[i]):
        y=9+r
        for x in range(32):p[x,y]=(0,0,0,0)
        for x in range(l,rt+1):p[x,y]=Wc
        p[l,y]=K;p[rt,y]=K
    for ex in (12,18):
        for r,row in enumerate(EYE):
            for c,ch in enumerate(row):
                if ch=='#':p[ex+c,9+r]=K
sheet=Image.open(D+'sprites.png').convert('RGBA');meta=json.load(open(D+'sprites.json'))
W,H=sheet.size;new=Image.new('RGBA',(W,H+38));new.alpha_composite(sheet,(0,0))
for i,c in enumerate(res):
    x=6+i*38;y=H+3;new.alpha_composite(c,(x,y));meta['frames'][f'mob.aitsu.{i}']={'x':x,'y':y,'w':32,'h':32,'s':1}
meta['custom']=sorted(set(meta.get('custom',[]))|{'mob.aitsu.0','mob.aitsu.1'})
new.save(D+'sprites.png');json.dump(meta,open(D+'sprites.json','w'),ensure_ascii=False,indent=1)
print('aitsu ok')
