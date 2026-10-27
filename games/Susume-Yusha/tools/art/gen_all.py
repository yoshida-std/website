# 仲間・町の人・敵の絵（勇者に合わせた絵）を作り直して sprites.png に足す: python3 games/Susume-Yusha/tools/art/gen_all.py のあと node games/Susume-Yusha/tools/export-sprites.js --from-sheet
import sys,json,os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from people import *;import enemies as E
from PIL import Image
import os
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')+'/'
cells={}
for k in ('warrior','mage','priest'):
    sp=SPECS[k];cells[f'char.{k}.0']=(person_side(sp,0),2/3);cells[f'char.{k}.1']=(person_side(sp,1),2/3);cells[f'char.{k}.pose']=(person_front(sp),2/3)
for k in ('town','child','woman','merchant','soldier','princess','king'):
    sp=SPECS[k]
    for fr in (0,1):
        cells[f'mob.{k}.{fr}']=((person_side(sp,fr,48,36,scale=.72) if k=='child' else person_side(sp,fr)),2/3)
cells['enemy.slime.0']=(E.slime(0),.25);cells['enemy.slime.1']=(E.slime(1),.25)   # スライムは小さめ（表示 18x15）
cells['enemy.bat.0']=(E.bat(0),.5);cells['enemy.bat.1']=(E.bat(1),.5)
cells['enemy.skel.0']=(E.skel(0),.5);cells['enemy.skel.1']=(E.skel(1),.5)
cells['enemy.wiz.0']=(E.wiz(0),.5)
sheet=Image.open(D+'sprites.png').convert('RGBA');meta=json.load(open(D+'sprites.json'))
W,H=sheet.size;rowh=max(c.height for c,_ in cells.values())
per=12;rows=(len(cells)+per-1)//per
new=Image.new('RGBA',(max(W,per*(72+6)+6),H+rows*(rowh+6)));new.alpha_composite(sheet,(0,0))
for i,(k,(c,s)) in enumerate(cells.items()):
    x=6+(i%per)*(72+6);y=H+(i//per)*(rowh+6)+rowh-c.height
    new.alpha_composite(c,(x,y));meta['frames'][k]={'x':x,'y':y,'w':c.width,'h':c.height,'s':round(s,4)}
meta['custom']=sorted(set(meta.get('custom',[]))|set(cells))
meta['weaponInSprite']=sorted(set(meta.get('weaponInSprite',[]))|{'char.warrior','char.mage','char.priest','mob.soldier','mob.king'})
new.save(D+'sprites.png');json.dump(meta,open(D+'sprites.json','w'),ensure_ascii=False,indent=1)
print(len(cells),'cells')
