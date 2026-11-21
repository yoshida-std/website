// キャラの 3D モデル(Three.js)
// 段階1: 仮の円柱。段階2〜3で ローポリの箱モデルに おきかえる
// どのキャラも { obj: THREE.Object3D, update(...) } の形にして、あとで glTF に差しかえやすくする
export function makeChars(THREE,scene){
  function pillar(r,hgt,col){
    const g=new THREE.Group();
    const mat=new THREE.MeshLambertMaterial({color:col});
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,hgt,16),mat);m.position.y=hgt/2;g.add(m);
    const nose=new THREE.Mesh(new THREE.BoxGeometry(r*0.5,r*0.5,r*0.6),mat);nose.position.set(0,hgt*0.8,r);g.add(nose); // むきが わかるように
    scene.add(g);
    return {obj:g,mat,base:new THREE.Color(col)};
  }
  const hero=pillar(0.35,2.0,0x1f9d8a),ally=pillar(0.33,2.2,0x6a46b8);
  const enemies=[];
  function flash(c,on){c.mat.color.copy(on?WHITE:c.base);}
  const WHITE=new THREE.Color(0xffffff);
  // 画面から見た むき(yaw3。0=カメラのほうを向く)→ 世界の むき
  const worldYaw=(S,yaw3)=>-S.cam.yaw+(yaw3===undefined?Math.PI:yaw3);
  return {
    update(S,blink){
      const h=S.hero,a=S.ally;
      hero.obj.position.set(h.x,0,-h.z);hero.obj.rotation.y=worldYaw(S,h.yaw3);flash(hero,h.flash>0&&blink);
      ally.obj.position.set(a.x,0,-a.z);ally.obj.rotation.y=worldYaw(S,a.yaw3);flash(ally,a.flash>0&&blink);
      S.enemies.forEach((e,i)=>{
        let c=enemies[i];
        if(!c||c.color!==e.color){if(c)scene.remove(c.obj);c=enemies[i]=pillar(0.75,2.4,e.color);c.color=e.color;}
        c.obj.visible=!e.dead;
        if(e.dead)return;
        const sc=e.r*0.8;c.obj.scale.set(sc,sc,sc);
        c.obj.position.set(e.x,0,-e.z);c.obj.rotation.y=worldYaw(S,e.yaw3);
        const teleOn=e.tele>0;
        c.mat.color.set(e.flash>0&&blink?0xffffff:(teleOn&&blink?0xc04a40:e.color));
      });
    }
  };
}
