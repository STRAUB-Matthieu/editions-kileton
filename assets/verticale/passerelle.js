/* La passerelle de verre : la scène 3D des 18 premières secondes (Three.js r186, lib/three.min.js).
   Tout est une fonction du temps t : Passerelle.rendu(t) dessine l'instant t, sans état entre deux images.

   Le lieu : une passerelle vitrée de 40 m entre la tour Vane (x 20) et la tour d'en face (x 60), plancher à 80 m.
   Le verre : quatre travées (x 30 → 40) sont découpées à l'avance en éclats (toile radiale + anneaux + refentes),
   posés jointifs ; les fissures sont des traits qui naissent quand le front de rupture les atteint.
   Les trois impacts (9,0 · 10,3 · 11,4 s) font avancer ce front ; le verre s'affaisse, puis chaque éclat
   se détache à son heure et tombe (g, vitesse initiale, rotation) ; la caméra tombe avec eux, au ralenti. */
(function(){
'use strict';
const T3=THREE;
const C={x:35.15,z:-0.3};                 // l'impact, juste devant les pas
const SOL=80, PLAF=84.5, BZ=3.0;           // plancher, toit, demi-largeur
const LAMPES=[]; for(let k=0;k<8;k++) LAMPES.push(new T3.Vector3(22.5+5*k,83.75,0));
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)), lerp=(a,b,k)=>a+(b-a)*k;
const outX=k=>k<=0?0:k>=1?1:1-Math.pow(2,-10*k);
const ss=(a,b,x)=>{const k=clamp((x-a)/(b-a));return k*k*(3-2*k);};

// ——— Le temps de la chute : ralenti à partir de 13,0 s (même fonction en GLSL) ———
// s(t) : 1 → 0,42 (13,0–13,5), tenu jusqu'à 15,0, → 0,9 (15,0–16,2). tau = intégrale de s depuis 12,8.
function tau(t){
  const seg=[[12.8,1,13.0,1],[13.0,1,13.5,.42],[13.5,.42,15.0,.42],[15.0,.42,16.2,.9],[16.2,.9,99,.9]];
  let a=0; if(t<=12.8) return 0;
  for(const [t0,s0,t1,s1] of seg){ if(t<=t0) break; const te=Math.min(t,t1), k=(te-t0)/(t1-t0);
    a+=(te-t0)*(s0+(s0+(s1-s0)*k))/2; }
  return a;
}
const GL_TAU=`
float tau(float t){
  float a=0.;
  if(t<=12.8) return 0.;
  float te;
  te=min(t,13.0); a+=te-12.8; if(t<=13.0) return a;
  te=min(t,13.5); {float k=(te-13.0)/.5; a+=(te-13.0)*(1.+(1.+(.42-1.)*k))/2.;} if(t<=13.5) return a;
  te=min(t,15.0); a+=(te-13.5)*.42; if(t<=15.0) return a;
  te=min(t,16.2); {float k=(te-15.0)/1.2; a+=(te-15.0)*(.42+(.42+.48*k))/2.;} if(t<=16.2) return a;
  return a+(t-16.2)*.9;
}`;

// ——— Le front de rupture : rayon atteint au temps t ———
function front(t){
  let r=0;
  if(t>=9.0) r=.62*outX((t-9.0)/.22);
  if(t>=10.3) r=.62+(2.3-.62)*outX((t-10.3)/.42);
  if(t>=11.4) r=2.3+(8.2-2.3)*outX((t-11.4)/.75);
  return r;
}
const TF=[]; for(let i=0;i<=4000;i++) TF.push(front(8.99+i*.001));
function tFront(r){ for(let i=0;i<TF.length;i++) if(TF[i]>=r) return 8.99+i*.001; return 13; }
// l'affaissement : petites flexions à chaque impact, puis le verre feuilleté se creuse avant de lâcher
function affaisse(t){
  const imp=(ti,a)=>t<ti?0:a*(1-Math.exp(-(t-ti)*9));
  return imp(9.0,.004)+imp(10.3,.009)+imp(11.4,.016)+.11*Math.pow(ss(11.9,12.85,t),1.6);
}
const GL_SAG=`
float affaisse(float t){
  float s=0.;
  if(t>9.0) s+=.004*(1.-exp(-(t-9.0)*9.));
  if(t>10.3) s+=.009*(1.-exp(-(t-10.3)*9.));
  if(t>11.4) s+=.016*(1.-exp(-(t-11.4)*9.));
  float k=clamp((t-11.9)/.95,0.,1.); k=k*k*(3.-2.*k);
  return s+.11*pow(k,1.6);
}
float frontR(float t){
  float r=0.;
  if(t>=9.0) r=.62*(1.-pow(2.,-10.*clamp((t-9.0)/.22,0.,1.)));
  if(t>=10.3) r=.62+1.68*(1.-pow(2.,-10.*clamp((t-10.3)/.42,0.,1.)));
  if(t>=11.4) r=2.3+5.9*(1.-pow(2.,-10.*clamp((t-11.4)/.75,0.,1.)));
  return r;
}
// forme de la flexion : nulle sur les poutres (tous les 2,5 m) et contre les rives
float forme(vec2 q, float t){
  float u=fract((q.x-30.)/2.5);
  float bx=pow(sin(3.14159*u),.7);
  float bz=cos(1.5708*clamp(q.y/3.,-1.,1.));
  vec2 d=q-vec2(${C.x},${C.z});
  float r=length(d);
  float zone=step(30.,q.x)*step(q.x,40.);
  float atteint=smoothstep(frontR(t)+.05,frontR(t)-.35,r);
  return bx*bz*exp(-r*r/(2.*2.0*2.0))*zone*atteint;
}`;

// ——— La ville la nuit (même lumière que le reste de la page) ———
const VILLE=`
const vec3 NUIT=vec3(.039,.086,.157), ABY=vec3(.024,.035,.071), AZP=vec3(0.,.224,.349), VOR=vec3(.243,.431,.62);
const vec3 ORP=vec3(.91,.83,.545), OR=vec3(.83,.686,.216), INC=vec3(1.,.953,.839), BRAISE=vec3(.788,.467,.18);
uniform float uT, uFoot;
float h12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 h22(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+1.),f.x),f.y);}
// le ciel de janvier, « noir d'encre, constellé d'étoiles » : une étoile par cellule d'un cube, rares, inégales
float etoiles(vec3 r){
  vec3 a=abs(r); vec2 uv;
  if(a.y>a.x&&a.y>a.z) uv=r.xz/a.y+vec2(7.,0.); else if(a.x>a.z) uv=r.zy/a.x+vec2(3.,5.*sign(r.x)); else uv=r.xy/a.z+vec2(-3.,9.*sign(r.z));
  uv*=230.; vec2 ce=floor(uv), f=fract(uv)-.5;
  float hh=h12(ce), o=length(f-(h22(ce)-.5)*.55);
  float b=pow(h12(ce+3.7),5.);
  return step(.9935,hh)*exp(-o*o*34.)*(.25+2.2*b)*(.82+.18*sin(uT*(2.+hh*9.)+hh*60.));
}
vec3 ciel(vec3 r){
  float y=r.y;
  vec3 c=mix(AZP*.32+NUIT*.45, NUIT*.5, smoothstep(0.,.55,y));
  c=mix(c, ABY*.55, smoothstep(.35,.95,y));                           // le zénith est plus noir que l'horizon, que la ville éclaire
  c+=vec3(.32,.18,.08)*exp(-abs(y)*8.)*.38;
  if(y>.03) c+=vec3(.86,.9,1.)*etoiles(r)*.55*smoothstep(.06,.42,y);
  if(y<0.) c=mix(c, NUIT*.35+vec3(.10,.06,.03)*.5, smoothstep(0.,-.25,y));
  return c;
}
vec2 boite(vec3 ro, vec3 rd, vec3 a, vec3 b, out vec3 n){
  vec3 iv=1./rd, t0=(a-ro)*iv, t1=(b-ro)*iv, tn=min(t0,t1), tf=max(t0,t1);
  float n0=max(max(tn.x,tn.y),tn.z), f0=min(min(tf.x,tf.y),tf.z);
  n=-sign(rd)*step(tn.yzx,tn.xyz)*step(tn.zxy,tn.xyz);
  return vec2(n0,f0);
}
const int NB=21;
const vec3 BA[NB]=vec3[NB](vec3(-20,0,-20),vec3(60,0,-16),vec3(-82,0,-72),vec3(-72,0,40),vec3(26,0,46),vec3(-22,0,-118),vec3(100,0,-82),vec3(108,0,28),vec3(-148,0,-22),vec3(-60,0,120),vec3(160,0,-10),
  vec3(-64,0,-160),vec3(62,0,-158),vec3(-146,0,78),vec3(40,0,122),vec3(186,0,62),vec3(122,0,-168),vec3(-206,0,-104),vec3(-124,0,162),vec3(226,0,-92),vec3(-2,0,-214));
const vec3 BB[NB]=vec3[NB](vec3(20,308,20),vec3(92,240,16),vec3(-40,184,-30),vec3(-30,128,86),vec3(68,154,90),vec3(30,216,-64),vec3(142,118,-40),vec3(150,172,70),vec3(-100,142,22),vec3(-10,96,170),vec3(200,206,40),
  vec3(-26,262,-122),vec3(98,168,-118),vec3(-104,198,116),vec3(78,226,158),vec3(224,138,98),vec3(160,272,-128),vec3(-166,182,-64),vec3(-84,146,198),vec3(262,196,-54),vec3(36,176,-176));
vec3 facade(vec3 p, vec3 n, vec3 rd, float id, float d){
  float fp=d*uFoot;
  if(n.y>.5){
    vec2 g=fract(p.xz/6.); float m=step(.92,max(g.x,g.y));
    return vec3(.025,.03,.045)+m*.012+INC*step(.995,h12(floor(p.xz/3.)+id))*.25*clamp(1.-fp,0.,1.);
  }
  vec3 tg=vec3(-n.z,0.,n.x);
  float u=dot(p,tg);
  vec2 q=vec2(u/1.6, p.y/3.5); vec2 ci=floor(q), f=fract(q);
  float wx=max(.05, fp/1.6*1.2), wy=max(.07, fp/3.5*1.2);
  float mm=smoothstep(0.,wx,f.x)*smoothstep(1.,1.-wx,f.x);
  float dl=smoothstep(0.,wy,f.y)*smoothstep(1.,1.-wy*1.6,f.y);
  float verre=mm*dl;
  vec3 r=reflect(rd,n); float fr=.05+.95*pow(1.-max(dot(-rd,n),0.),5.);
  vec3 refl=ciel(r)*(1.05+.35*vn(ci*.37+id));
  float h=h12(ci+id*13.1), h2=h12(ci.yx*1.7+id);
  float rang=h12(vec2(ci.y,id*3.));
  float allume=step(.90-.22*step(.62,rang),h);
  // la tour d'en face reçoit : son étage de la passerelle est la réception, tout allumé
  if(id==1. && p.y>76. && p.y<90.) allume=max(allume, step(.25,h));
  vec3 ld=vec3(dot(rd,tg), rd.y, dot(rd,-n));
  vec3 lp=vec3(f.x*1.6, f.y*3.5, 0.);
  float tx=ld.x>0.?(1.6-lp.x)/ld.x:lp.x/max(-ld.x,1e-3);
  float ty=ld.y>0.?(3.2-lp.y)/ld.y:lp.y/max(-ld.y,1e-3), tz=5./max(ld.z,1e-3);
  float tt=min(min(tx,ty),tz); vec3 hp=lp+ld*tt;
  float fond=step(tz,min(tx,ty)), plafond=step(ty,min(tx,tz))*step(0.,ld.y), solp=step(ty,min(tx,tz))*step(ld.y,0.);
  vec3 teinte=mix(vec3(1.,.70,.40), vec3(.92,.94,1.), step(.7,h2));
  float prof=1.-.6*hp.z/5.;
  vec3 tiede=teinte*(.10+.32*h2)*prof*(fond*.8+plafond*1.6+solp*.35+(1.-fond-plafond-solp)*.55);
  tiede+=teinte*.35*smoothstep(.9,1.,hp.y/3.2)*fond;
  vec3 piece=tiede*allume+NUIT*.08;
  piece=mix(piece, teinte*.045*(rang>.62?1.6:.6)+NUIT*.08, clamp(fp*1.2,0.,1.));
  float onde=.85+.15*vn(vec2(u*.02, p.y*.01)+id)+.06*(h2-.5);
  vec3 vitre=mix(piece, refl*onde, fr*.85+.22);
  vitre+=VOR*.025*smoothstep(.0,.4,f.y)*(1.-allume);
  if(id<.5){
    // la tour Vane : sa façade électrochrome, programmée pour l'inauguration, passe du violet profond au doré ;
    // l'or monte d'étage en étage pendant la soirée
    float front=70.+uT*11.+10.*vn(vec2(u*.03,id));
    float kg=smoothstep(front+16.,front-16.,p.y);
    vec3 em=mix(vec3(.17,.045,.34),vec3(.98,.68,.27),kg)*(.24+.30*h)*(.86+.14*sin(uT*.7+ci.y*.19+u*.05));
    em*=1.-.35*smoothstep(.0,.25,f.y)*smoothstep(.55,.25,f.y);
    vitre=mix(em*mix(1.,.45,clamp(fp*1.2,0.,1.)), refl*onde, fr*.55+.06);
  }
  vec3 cadre=vec3(.07,.08,.10)+refl*.25+ORP*.015;
  return mix(cadre, vitre, verre);
}
vec2 bi(vec2 q){return floor(q/80.+.5);}
vec3 sol(vec3 p, float d){
  float fp=d*uFoot;
  vec2 q=p.xz;
  float lz=abs(fract(q.y/80.+.5)-.5)*80., lx=abs(fract(q.x/80.+.5)-.5)*80.;
  float rue=1.-smoothstep(7.,7.+max(.5,fp),min(lx,lz));
  vec3 c=vec3(.016,.021,.034)*(1.-rue*.4);
  vec2 w=floor(q/2.6); float wh=h12(w);
  float det=clamp(1.-fp/2.2,0.,1.);
  float fen=step(.965,wh)*(1.-rue)*step(.5,h12(bi(q)));
  c+=mix(vec3(.05,.035,.02)*.18, fen*mix(vec3(1.,.74,.42),vec3(.7,.82,1.),step(.99,wh))*.32, det)*(1.-rue);
  // « comme un circuit imprimé géant » : les rues secondaires en pistes fines, et des diodes qui pulsent sur les toits
  float l2=min(abs(fract(q.x/20.+.5)-.5),abs(fract(q.y/20.+.5)-.5))*20.;
  float piste=(1.-smoothstep(.18,.18+max(.35,fp),l2))*(1.-rue);
  c+=vec3(1.,.70,.36)*piste*.045*clamp(1.-fp/4.,0.,1.);
  vec2 dc=floor(q/9.); float dh=h12(dc+51.);
  float diode=step(.985,dh)*exp(-dot(fract(q/9.)-.5,fract(q/9.)-.5)*90.)*(.5+.5*sin(uT*(1.5+dh*4.)+dh*40.))*(1.-rue);
  c+=mix(vec3(1.,.25,.15),vec3(.6,.85,1.),step(.993,dh))*diode*.5*clamp(1.-fp/3.,0.,1.);
  float r=max(.7,fp*.8), e=(.7*.7)/(r*r);
  vec3 L=vec3(0);
  for(int s=0;s<2;s++){
    float lat=s==0?lz:lx; float lon=s==0?q.x:q.y;
    float side=s==0?sign(fract(q.y/80.+.5)-.5):sign(fract(q.x/80.+.5)-.5);
    float dl=length(vec2(lat-6., (fract(lon/24.)-.5)*24.));
    L+=vec3(1.,.66,.3)*exp(-dl*dl/(2.*r*r))*e*1.6;
    float pos=lon+side*uT*13.+(s==0?37.:11.);
    float cell=floor(pos/31.); float fc=(fract(pos/31.)-.5)*31.;
    float on=step(.45,h12(vec2(cell,float(s)+side)));
    float dc=length(vec2(lat-2.6, fc));
    vec3 cc=side>0.?vec3(1.,.92,.8):vec3(1.,.18,.1);
    L+=cc*on*exp(-dc*dc/(2.*r*r))*e*1.2;
  }
  c+=L*rue*1.15+L*.25;
  return c;
}
vec3 brume(vec3 c, float d, float y){
  vec3 fc=NUIT*.55+vec3(.09,.06,.035)*.55;
  float k=1.-exp(-d*.0021);
  return mix(c, fc, k*(.7+.3*smoothstep(150.,0.,y)));
}
vec3 ville(vec3 ro, vec3 rd){
  float tb=1e9; vec3 nb=vec3(0); float ib=0.;
  for(int i=0;i<NB;i++){ vec3 n; vec2 t=boite(ro,rd,BA[i],BB[i],n); if(t.x<t.y&&t.x>0.&&t.x<tb){tb=t.x;nb=n;ib=float(i);} }
  float tg=rd.y<0.?-ro.y/rd.y:1e9;
  vec3 c; float d; float y;
  if(tb<tg){ vec3 p=ro+rd*tb; c=facade(p,nb,rd,ib,tb); d=tb; y=p.y; }
  else if(tg<1e8){ vec3 p=ro+rd*tg; c=sol(p,tg); d=tg; y=0.; }
  else return ciel(rd);
  return brume(c,d,y);
}`;

// Lumières de la passerelle, partagées par l'acier et le verre
const LUM=`
uniform vec3 uLampes[8];
uniform vec4 uFlash;   // « les flashs crépitaient » : position, intensité
// ce que le verre réfléchit : le toit vitré, ses lampes, la réception, le ciel
vec3 reflet(vec3 p, vec3 r){
  vec3 c;
  bool dedans=p.x>20.&&p.x<60.&&abs(p.z)<3.05&&p.y>79.5&&p.y<84.6;
  if(r.y>0.){
    c=ciel(r)*.85;
    if(dedans){ float t=(84.5-p.y)/r.y; vec3 q=p+r*t;
      // le toit vu en reflet : verre noir, poutres éclairées par les lampes, filets de rive
      float poutre=1.-smoothstep(.03,.07,abs(fract(q.x/2.5+.5)-.5)*2.5);
      float pres=exp(-pow((fract((q.x-22.5)/5.+.5)-.5)*5.,2.)*.9)*exp(-q.z*q.z*.25);
      c=c*.8+ORP*.10*pres;
      c=mix(c, vec3(.05,.045,.04)+ORP*.22*pres, poutre*.9);
      c+=ORP*.16*exp(-pow(abs(q.z)-2.92,2.)*60.);
    } else if(p.y<80.){
      // sous la passerelle : son ventre, éclairé de l'intérieur, et le trou
      float t=(80.-p.y)/r.y; vec3 q=p+r*t;
      if(abs(q.z)<3.05&&q.x>20.&&q.x<60.){
        float poutre=1.-smoothstep(.06,.1,abs(fract(q.x/2.5+.5)-.5)*2.5);
        float trou=step(30.,q.x)*step(q.x,40.);
        vec3 L=mix(BRAISE,ORP,.7)*(.30+.30*trou)+INC*.35*exp(-pow((fract((q.x-22.5)/5.+.5)-.5)*5.,2.))*exp(-q.z*q.z*.3);
        L+=ORP*.4*exp(-pow(abs(q.z)-2.92,2.)*40.);
        c=mix(L, vec3(.025,.024,.025), poutre*.85);
      }
    }
  } else {
    c=p.y<79.5?ville(p,r):NUIT*.22+vec3(.07,.045,.02)*.25*smoothstep(-.2,-1.,r.y);
  }
  if(r.x>0.&&dedans){ float t=(60.-p.x)/r.x; vec3 q=p+r*t; if(abs(q.z)<2.9&&q.y>80.&&q.y<84.4) c+=mix(BRAISE,ORP,.6)*.55*(.7+.3*sin(q.z*2.3)); }
  for(int i=0;i<8;i++){ vec3 L=uLampes[i]-p; float tc=dot(L,r); if(tc>0.){ float d2=dot(L,L)-tc*tc; float s=.0025+tc*tc*.00012;
    c+=INC*3.5*exp(-d2/s)*min(1.,.0025/s*2.); } }
  if(uFlash.w>0.){ vec3 L=uFlash.xyz-p; float tc=dot(L,r); if(tc>0.){ float d2=dot(L,L)-tc*tc; float s=.003+tc*tc*.0002;
    c+=vec3(.92,.96,1.)*uFlash.w*.06*exp(-d2/s)*min(1.,.003/s*2.); } }
  return c;
}
float proche(vec3 p){ float s=0.; for(int i=0;i<8;i++){ vec3 L=uLampes[i]-p; s+=2./(1.+dot(L,L)); } vec3 F=uFlash.xyz-p; return s+uFlash.w*.4/(1.+dot(F,F)); }
vec3 eclaire(vec3 p, vec3 n, vec3 v, float rug){ // lampes : diffus + spéculaire, chaleur des filets de rive
  vec3 c=vec3(0);
  for(int i=0;i<8;i++){ vec3 L=uLampes[i]-p; float d2=dot(L,L); L*=inversesqrt(d2);
    float df=max(dot(n,L),0.); vec3 h=normalize(L+v); float sp=pow(max(dot(n,h),0.),mix(90.,12.,rug));
    c+=vec3(1.,.78,.52)*(df*.6+sp*1.5*(1.-rug*.6))*5.2/(1.+d2); }
  if(uFlash.w>0.){ vec3 L=uFlash.xyz-p; float d2=dot(L,L); L*=inversesqrt(d2);
    float df=max(dot(n,L),0.); vec3 h=normalize(L+v); float sp=pow(max(dot(n,h),0.),mix(90.,12.,rug));
    c+=vec3(.92,.96,1.)*(df*.6+sp*1.5*(1.-rug*.6))*uFlash.w/(1.+d2); }
  bool dd=p.x>19.9&&p.x<60.1&&abs(p.z)<3.2&&p.y>79.3&&p.y<84.8;
  if(dd) c+=ORP*(.10+.10*exp(-max(p.y-80.,0.)*1.1));          // la salle est chaude : la lumière rebondit partout
  return c;
}`;

// ——— Géométrie de la fracture ———
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const R=rng(880);
const ANN=[.03,.075,.14,.23,.35,.5,.69,.92,1.2,1.53,1.93,2.4,2.95,3.6,4.35,5.25,6.3,7.6,9.1];
const NA=ANN.length;
// fissures radiales : primaires dès l'impact, secondaires plus tard, ramifications vers l'extérieur
const rayons=[];
function ajoute(a,s,type){
  for(const q of rayons){ if(q.s<=s){ let d=Math.abs(((a-q.a)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI); if(d<(s<3?.16:s<8?.1:.055)) return; } }
  rayons.push({a,s,type,ph:R()*6.283,amp:.035+R()*.07,f:1.2+R()*1.6,ph2:R()*6.283,dl:R()});
}
for(let i=0;i<11;i++) ajoute((i+R()*.7)/11*2*Math.PI,0,0);
for(let i=0;i<30;i++) ajoute(R()*2*Math.PI,1+Math.floor(R()*3),1);
for(let i=0;i<120;i++) ajoute(R()*2*Math.PI,4+Math.floor(R()*(NA-6)),2);
const angle=(q,r)=>q.a+q.amp*Math.sin(q.f*Math.log(r/.02)+q.ph)+.025*Math.sin(r*9+q.ph2);
// anneaux : rayon modulé selon l'angle ; un segment d'anneau peut manquer (l'éclat continue)
const annPh=ANN.map(()=>[R()*6.283,R()*6.283,R()*6.283]);
const rho=(j,a)=>{const p=annPh[j];return ANN[j]*(1+.07*Math.sin(3*a+p[0])+.045*Math.sin(7*a+p[1])+.03*Math.sin(13*a+p[2]));};
const pt=(r,a)=>[C.x+r*Math.cos(a),C.z+r*Math.sin(a)];
const noeud=(q,j)=>{ let r=ANN[j]; for(let k=0;k<3;k++) r=rho(j,angle(q,r)); return pt(r,angle(q,r)); };
const naitRayon=(q,r)=>{ const s0=q.type===0?9.0:q.type===1?10.3+q.dl*.25:0;
  return Math.max(tFront(r)+(q.type===0?0:.03+q.dl*.08), s0, q.s>0?tFront(ANN[q.s])+.02:0); };

// cellules : bande j entre l'anneau j et j+1, entre deux rayons actifs consécutifs
const actifs=j=>rayons.filter(q=>q.s<=j).sort((a,b)=>((a.a%(2*Math.PI))+2*Math.PI)%(2*Math.PI)-((b.a%(2*Math.PI))+2*Math.PI)%(2*Math.PI));
const normA=a=>((a%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
const cells=[], fissures=[];
const anneauPresent=[]; // [j][clé rayon a] : le segment d'anneau j+1 qui ferme la cellule
for(let j=0;j<NA-1;j++){
  const A=actifs(j), A2=actifs(j+1);
  for(let i=0;i<A.length;i++){
    const qa=A[i], qb=A[(i+1)%A.length];
    let a0=normA(qa.a), a1=normA(qb.a); if(a1<=a0) a1+=2*Math.PI;
    const poly=[];
    // bord intérieur (anneau j) de a vers b : une corde
    poly.push(noeud(qa,j));
    // rayon b, de j à j+1, avec un point au milieu
    const rm=(ANN[j]+ANN[j+1])/2;
    poly.push(noeud(qb,j)); poly.push(pt(rm,angle(qb,rm)));
    // bord extérieur (anneau j+1) de b vers a, par les rayons qui naissent sur cet anneau
    const naissants=A2.filter(q=>q.s===j+1).map(q=>({q,a:normA(q.a)})).map(o=>({q:o.q,a:o.a<a0?o.a+2*Math.PI:o.a})).filter(o=>o.a>a0&&o.a<a1).sort((x,y)=>y.a-x.a);
    poly.push(noeud(qb,j+1)); naissants.forEach(o=>poly.push(noeud(o.q,j+1))); poly.push(noeud(qa,j+1));
    poly.push(pt(rm,angle(qa,rm)));
    cells.push({poly,j,r:rm});
  }
  // fissures radiales de la bande
  for(const q of A){
    const rm=(ANN[j]+ANN[j+1])/2;
    const p0=noeud(q,j), p1=pt(rm,angle(q,rm)), p2=noeud(q,j+1);
    fissures.push([p0,p1,naitRayon(q,ANN[j]),naitRayon(q,rm),q.type]);
    fissures.push([p1,p2,naitRayon(q,rm),naitRayon(q,ANN[j+1]),q.type]);
  }
  // l'anneau j+1 : cordes entre les rayons actifs de la bande j+1
  if(j+1<NA-1||true){
    const rj=ANN[j+1], tb=tFront(rj)+.04+R()*.10+(rj<.6?0:R()*.18);
    for(let i=0;i<A2.length;i++){ const qa=A2[i], qb=A2[(i+1)%A2.length];
      if(R()<(rj<.3?.95:rj<2?.82:.7)) fissures.push([noeud(qa,j+1),noeud(qb,j+1),tb+R()*.05,tb+R()*.05+.03,3]); }
  }
}

// découpe par les travées : le verre tombe entre x 30 et 40 ; les travées voisines se fissurent sans tomber
const TRAV=[]; for(let x=30;x<40;x+=2.5) TRAV.push([x+.08,x+2.5-.08,-BZ+.1,BZ-.1]);
const TRAV_F=[[27.5+.08,30-.08,-BZ+.1,BZ-.1],...TRAV,[40.08,42.5-.08,-BZ+.1,BZ-.1]];
function clipPoly(P,[x0,x1,z0,z1]){
  const bords=[[p=>p[0]-x0,0,x0],[p=>x1-p[0],0,x1],[p=>p[1]-z0,1,z0],[p=>z1-p[1],1,z1]];
  let out=P;
  for(const [f,ax,v] of bords){ const inn=out; out=[]; if(!inn.length) break;
    for(let i=0;i<inn.length;i++){ const a=inn[i], b=inn[(i+1)%inn.length], fa=f(a), fb=f(b);
      if(fa>=0) out.push(a);
      if((fa>=0)!==(fb>=0)){ const k=fa/(fa-fb); out.push([a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k]); } } }
  return out;
}
function clipSeg(a,b,[x0,x1,z0,z1]){
  let t0=0,t1=1; const dx=b[0]-a[0], dz=b[1]-a[1];
  for(const [p,q] of [[-dx,a[0]-x0],[dx,x1-a[0]],[-dz,a[1]-z0],[dz,z1-a[1]]]){
    if(p===0){ if(q<0) return null; continue; } const r=q/p;
    if(p<0){ if(r>t1) return null; if(r>t0) t0=r; } else { if(r<t0) return null; if(r<t1) t1=r; } }
  return [t0,t1];
}
const aire=P=>{let s=0;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];s+=a[0]*b[1]-b[0]*a[1];}return s/2;};
const centre=P=>{let x=0,z=0;P.forEach(p=>{x+=p[0];z+=p[1];});return [x/P.length,z/P.length];};

const eclats=[];
for(const c of cells) for(const tr of TRAV){
  let P=clipPoly(c.poly,tr); if(P.length<3) continue;
  if(aire(P)<0) P.reverse();
  if(Math.abs(aire(P))<2e-5) continue;
  // les grandes plaques se refendent
  const pile=[P];
  while(pile.length){ const Q=pile.pop(), A=Math.abs(aire(Q));
    if(A>.22&&pile.length<6){ const [cx,cz]=centre(Q), th=R()*Math.PI, nx=Math.cos(th), nz=Math.sin(th);
      const hp=(s)=>{ const out=[]; for(let i=0;i<Q.length;i++){ const a=Q[i], b=Q[(i+1)%Q.length];
        const fa=s*((a[0]-cx)*nx+(a[1]-cz)*nz), fb=s*((b[0]-cx)*nx+(b[1]-cz)*nz);
        if(fa>=0) out.push(a); if((fa>=0)!==(fb>=0)){ const k=fa/(fa-fb); out.push([a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k]); } } return out; };
      const Q1=hp(1), Q2=hp(-1);
      if(Q1.length>=3&&Q2.length>=3){ pile.push(Q1,Q2);
        const sur=Q1.filter(p=>Math.abs((p[0]-cx)*nx+(p[1]-cz)*nz)<1e-9);
        if(sur.length>=2){ const r=Math.hypot(cx-C.x,cz-C.z), tb=Math.max(tFront(r)+.08+R()*.25,11.5+R()*.4);
          for(const tr2 of TRAV){ const k=clipSeg(sur[0],sur[1],tr2); if(k) { fissures.push([sur[0],sur[1],tb,tb+.04,4]); break; } } }
        continue; } }
    eclats.push(Q); }
}

// ——— Maillage des éclats : un seul tampon, animé dans le shader ———
const EP=.02;
function construitEclats(){
  const pos=[], nor=[], cen=[], par=[], gond=[], flag=[], rep=[];
  const pousse=(p,n,c,pa,g,f,rp)=>{pos.push(...p);nor.push(...n);cen.push(...c);par.push(...pa);gond.push(...g);flag.push(f);rep.push(...rp);};
  const ajout=(Q,options)=>{
    const [cx,cz]=centre(Q); const r=Math.hypot(cx-C.x,cz-C.z);
    const A=Math.abs(aire(Q));
    let trel=12.8+.05*r+.09*R()+(r>2.?R()*.5:0), mode=options.mode;
    // près d'une poutre ou d'une rive, loin de l'impact : certains éclats restent accrochés et pendent
    const dxb=Math.min(...[30,32.5,35,37.5,40].map(x=>Math.abs(cx-x))), dzr=BZ-Math.abs(cz);
    let g=[0,0,0,0];
    if(mode===0&&r>1.9&&Math.min(dxb,dzr)<.42&&R()<.55){
      mode=1;
      if(dxb<dzr){ const xb=[30,32.5,35,37.5,40].reduce((a,x)=>Math.abs(cx-x)<Math.abs(cx-a)?x:a); g=[xb,0,0,cx>xb?1:-1]; }
      else g=[0,Math.sign(cz)*(BZ-.1),1,cz>0?-1:1];
      g[0]=g[0]||0;
    }
    const pa=[trel,R(),1/Math.sqrt(Math.max(A,.0004))*.12,mode];
    const c=[cx,SOL-EP/2,cz];
    const tri=T3.ShapeUtils.triangulateShape(Q.map(p=>new T3.Vector2(p[0],p[1])),[]);
    const top=Q.map(p=>[p[0],SOL,p[1]]), bot=Q.map(p=>[p[0],SOL-EP,p[1]]);
    const rp=(p)=>[p[0],p[2]];
    for(const [a,b,d] of tri){ // dessus (sens trigonométrique vu d'en haut) et dessous
      for(const k of [a,d,b]) pousse(top[k],[0,1,0],c,pa,g,0,rp(top[k]));
      for(const k of [a,b,d]) pousse(bot[k],[0,-1,0],c,pa,g,0,rp(bot[k]));
    }
    for(let i=0;i<Q.length;i++){ const i2=(i+1)%Q.length; const a=top[i],b=top[i2],a2=bot[i],b2=bot[i2];
      let nx=Q[i2][1]-Q[i][1], nz=-(Q[i2][0]-Q[i][0]); const l=Math.hypot(nx,nz)||1; nx/=l; nz/=l;
      if(aire(Q)<0){nx=-nx;nz=-nz;}
      const n=[nx,0,nz];
      for(const p of [a,b,b2,a,b2,a2]) pousse(p,n,c,pa,g,1,rp(p)); }
  };
  eclats.forEach(Q=>ajout(Q,{mode:0}));
  // la poudre de verre au point d'impact : de minuscules éclats, cachés tant que le verre tient
  for(let i=0;i<260;i++){ const a=R()*6.283, r=Math.pow(R(),1.6)*.55, s=.008+R()*.022;
    const x=C.x+r*Math.cos(a), z=C.z+r*Math.sin(a), b=R()*6.283;
    const Q=[0,1,2].map(k=>[x+s*Math.cos(b+k*2.1+R()*.5),z+s*Math.sin(b+k*2.1+R()*.5)]);
    if(aire(Q)<0) Q.reverse(); ajout(Q,{mode:3}); }
  const G=new T3.BufferGeometry();
  G.setAttribute('position',new T3.Float32BufferAttribute(pos,3));
  G.setAttribute('normal',new T3.Float32BufferAttribute(nor,3));
  G.setAttribute('aC',new T3.Float32BufferAttribute(cen,3));
  G.setAttribute('aP',new T3.Float32BufferAttribute(par,4));
  G.setAttribute('aG',new T3.Float32BufferAttribute(gond,4));
  G.setAttribute('aF',new T3.Float32BufferAttribute(flag,1));
  G.setAttribute('aR',new T3.Float32BufferAttribute(rep,2));
  G.boundingSphere=new T3.Sphere(new T3.Vector3(35,60,0),200);
  return G;
}
// panneaux intacts (et vitres des parois, du toit) : mêmes attributs, mode 2 = immobile
function construitPanneaux(){
  const pos=[], nor=[], cen=[], par=[], gond=[], flag=[], rep=[];
  const quad=(a,b,c,d,n)=>{ for(const p of [a,b,c,a,c,d]){pos.push(...p);nor.push(...n);cen.push(0,0,0);par.push(99,0,0,2);gond.push(0,0,0,0);flag.push(0);rep.push(p[0],p[2]);} };
  for(let x=20;x<60;x+=2.5){ if(x>=30&&x<40) continue; const x0=x+.08,x1=x+2.5-.08, z0=-BZ+.1, z1=BZ-.1;
    quad([x0,SOL,z0],[x0,SOL,z1],[x1,SOL,z1],[x1,SOL,z0],[0,1,0]); }
  // parois et toit : de grandes vitres entre les montants
  for(let x=20;x<60;x+=2.5){ const x0=x+.05,x1=x+2.5-.05;
    for(const s of [-1,1]) quad([x0,SOL+.12,s*BZ],[x1,SOL+.12,s*BZ],[x1,PLAF-.06,s*BZ],[x0,PLAF-.06,s*BZ],[0,0,-s]);
    quad([x0,PLAF,-BZ],[x1,PLAF,-BZ],[x1,PLAF,BZ],[x0,PLAF,BZ],[0,-1,0]); }
  const G=new T3.BufferGeometry();
  G.setAttribute('position',new T3.Float32BufferAttribute(pos,3));
  G.setAttribute('normal',new T3.Float32BufferAttribute(nor,3));
  G.setAttribute('aC',new T3.Float32BufferAttribute(cen,3));
  G.setAttribute('aP',new T3.Float32BufferAttribute(par,4));
  G.setAttribute('aG',new T3.Float32BufferAttribute(gond,4));
  G.setAttribute('aF',new T3.Float32BufferAttribute(flag,1));
  G.setAttribute('aR',new T3.Float32BufferAttribute(rep,2));
  return G;
}
// fissures : rubans d'un pixel et demi, chaque bout porte son heure de naissance
function construitFissures(){
  const A=[], B=[], S=[], E=[], N=[], K=[];
  for(const [a,b,t0,t1,type] of fissures){
    for(const tr of TRAV_F){ const k=clipSeg(a,b,tr); if(!k) continue;
      const pa=[a[0]+(b[0]-a[0])*k[0],a[1]+(b[1]-a[1])*k[0]], pb=[a[0]+(b[0]-a[0])*k[1],a[1]+(b[1]-a[1])*k[1]];
      const L=Math.hypot(pb[0]-pa[0],pb[1]-pa[1]); if(L<1e-4) continue;
      const n=Math.max(1,Math.ceil(L/.05));
      const br=type===0?1:type===1?.8:type===3?.55:.6;
      for(let i=0;i<n;i++){
        const u0=i/n,u1=(i+1)/n;
        const p0=[pa[0]+(pb[0]-pa[0])*u0,SOL+.0015,pa[1]+(pb[1]-pa[1])*u0], p1=[pa[0]+(pb[0]-pa[0])*u1,SOL+.0015,pa[1]+(pb[1]-pa[1])*u1];
        const b0=lerp(t0,t1,lerp(k[0],k[1],u0)), b1=lerp(t0,t1,lerp(k[0],k[1],u1));
        for(const [s,e] of [[-1,0],[1,0],[1,1],[-1,0],[1,1],[-1,1]]){ A.push(...p0); B.push(...p1); S.push(s); E.push(e); N.push(e?b1:b0); K.push(br); }
      }
      break;
    }
  }
  const G=new T3.BufferGeometry();
  G.setAttribute('position',new T3.Float32BufferAttribute(A,3));
  G.setAttribute('aB',new T3.Float32BufferAttribute(B,3));
  G.setAttribute('aS',new T3.Float32BufferAttribute(S,1));
  G.setAttribute('aE',new T3.Float32BufferAttribute(E,1));
  G.setAttribute('aN',new T3.Float32BufferAttribute(N,1));
  G.setAttribute('aK',new T3.Float32BufferAttribute(K,1));
  G.boundingSphere=new T3.Sphere(new T3.Vector3(35,80,0),30);
  return G;
}

// ——— Shaders ———
const ROT=`
mat3 rotAxe(vec3 a, float t){ float c=cos(t), s=sin(t), k=1.-c;
  return mat3(c+a.x*a.x*k, a.y*a.x*k+a.z*s, a.z*a.x*k-a.y*s,
              a.x*a.y*k-a.z*s, c+a.y*a.y*k, a.z*a.y*k+a.x*s,
              a.x*a.z*k+a.y*s, a.y*a.z*k-a.x*s, c+a.z*a.z*k); }
vec3 h33(float n){ return fract(sin(vec3(n*127.1,n*311.7,n*74.7))*43758.5453); }`;
const VS_ECLAT=`
attribute vec3 aC; attribute vec4 aP; attribute vec4 aG; attribute float aF; attribute vec2 aR;
uniform float uT;
varying vec3 vP, vN; varying float vF, vCr, vSeed, vVu;
${GL_TAU}${GL_SAG}${ROT}
void main(){
  vec3 p=position, n=normal;
  float mode=aP.w;
  if(mode<1.5||mode>2.5){
    float tr=aP.x, ts=min(uT,tr);
    float s=affaisse(ts);
    vec2 q=aC.xz;
    // le verre feuilleté se creuse : chaque éclat suit la flexion et s'incline selon sa pente
    float w=forme(q,ts), wx=forme(q+vec2(.03,0.),ts), wz=forme(q+vec2(0.,.03),ts);
    vec3 nn=normalize(vec3(s*(wx-w)/.03,1.,s*(wz-w)/.03));
    vec3 ax=cross(vec3(0,1,0),nn); float sa=length(ax);
    mat3 Rs=sa>1e-5?rotAxe(ax/sa,asin(min(sa,1.))):mat3(1.);
    vec3 l=p-aC;
    vec3 c0=aC-vec3(0.,s*w,0.);
    p=c0+Rs*l; n=Rs*n;
    if(mode>2.5&&uT<tr) p=c0+l*0.;                         // la poudre n'existe qu'à la rupture
    if(uT>tr){
      float ti=tau(uT)-tau(tr);
      if(mode<.5||mode>2.5){
        vec3 hh=h33(aP.y*91.7+1.3);
        vec3 axe=normalize(hh-.5);
        float om=(.6+2.6*hh.x)*aP.z*(mode>2.5?3.:1.);
        mat3 Rr=rotAxe(axe,om*ti);
        vec2 rad=normalize(aC.xz-vec2(${C.x},${C.z})+1e-4);
        vec3 v0=vec3(rad.x,0.,rad.y)*(.15+.45*hh.y)+vec3(0.,-.35-.6*hh.z,0.);
        if(mode>2.5) v0=vec3(rad.x,0.,rad.y)*(.4+1.2*hh.y)+vec3(0.,-.2+.8*hh.z,0.);
        p=c0+Rr*Rs*l+v0*ti+vec3(0.,-4.905*ti*ti,0.);
        n=Rr*n;
      } else {
        // accroché : il pivote sur sa poutre ou sa rive, rebondit à peine, s'immobilise
        vec3 piv=aG.z<.5?vec3(aG.x,80.,aC.z):vec3(aC.x,80.,aG.y);
        vec3 axe=aG.z<.5?vec3(0.,0.,1.):vec3(1.,0.,0.);
        float amax=(.7+.5*fract(aP.y*7.3));
        float a=aG.w*amax*(1.-exp(-ti*3.2)*(cos(ti*7.)+.46*sin(ti*7.)));
        mat3 Rh=rotAxe(axe,-a);
        p=piv+Rh*(p-piv); n=Rh*n;
      }
    }
  }
  vP=p; vN=n; vF=aF; vSeed=aP.y;
  vVu=(mode<1.5||mode>2.5)?smoothstep(aP.x-.02,aP.x+.06,uT):1.;   // les tranches n'apparaissent qu'à la rupture
  vCr=length(aR-vec2(${C.x},${C.z}));
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`;
const FS_VERRE=`
precision highp float;
${VILLE}${LUM}
varying vec3 vP, vN; varying float vF, vCr, vSeed, vVu;
void main(){
  vec3 v=normalize(cameraPosition-vP);
  vec3 n=normalize(vN); if(dot(n,v)<0.) n=-n;
  float cs=abs(dot(n,v));
  vec3 rgb; float a;
  if(vF>.5){
    // la tranche : verte et claire, elle accroche la lumière des lampes
    vec3 l=eclaire(vP,n,v,.35);
    rgb=vec3(.50,.72,.64)*(.10+l*.8)+reflet(vP,reflect(-v,n))*.45+vec3(.5,.72,.64)*.05;
    a=.92*vVu;
    rgb*=vVu;
  } else {
    float F=.04+.96*pow(1.-cs,5.);
    vec3 r=reflect(-v,n);
    rgb=reflet(vP,r)*F;
    a=F+(1.-F)*mix(.085,.16,step(vP.y,79.5));
    rgb+=vec3(.004,.010,.009)+vec3(1.,.8,.55)*.05*proche(vP);   // la teinte du verre, la lumière qu'il diffuse
    // l'écrasement au point d'impact : verre blanchi, étoilé
    float cr=smoothstep(.11,.0,vCr)*step(9.0,uT);
    rgb+=vec3(.8,.78,.72)*cr*(.12+.25*eclaire(vP,n,v,.8).r*.2); a+=cr*.45;
    // poussière et traces : la vitre n'est pas parfaite
    float tr=vn(vP.xz*7.+vSeed)*vn(vP.xz*31.);
    rgb+=ORP*.012*smoothstep(.35,.7,tr)*(.3+F); a+=.02*tr;
  }
  gl_FragColor=vec4(rgb,clamp(a,0.,1.));
}`;
const VS_FISS=`
attribute vec3 aB; attribute float aS, aE, aN, aK;
uniform float uT, uPx; uniform vec2 uRes;
varying float vS, vN, vK, vR; varying vec2 vQ;
${GL_TAU}${GL_SAG}
vec3 plie(vec3 p){ float s=affaisse(uT); return p-vec3(0.,s*forme(p.xz,uT),0.); }
void main(){
  vec3 a=plie(position), b=plie(aB);
  vec4 ca=projectionMatrix*viewMatrix*vec4(a,1.), cb=projectionMatrix*viewMatrix*vec4(b,1.);
  vec2 sa=ca.xy/ca.w*uRes, sb=cb.xy/cb.w*uRes;
  vec2 d=normalize(sb-sa+1e-6); vec2 nrm=vec2(-d.y,d.x);
  vec4 c=aE>.5?cb:ca;
  c.xy+=nrm*aS*uPx/uRes*c.w;
  gl_Position=(ca.w<.04||cb.w<.04)?vec4(2.,2.,2.,1.):c;   // rien derrière l'œil
  vQ=(aE>.5?aB:position).xz; vS=aS; vN=aN; vK=aK; vR=length((aE>.5?aB:position).xz-vec2(${C.x},${C.z}));
}`;
const FS_FISS=`
precision highp float;
uniform float uT;
varying float vS, vN, vK, vR; varying vec2 vQ;
float h12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+1.),f.x),f.y);}
const vec3 ORP=vec3(.91,.83,.545), INC=vec3(1.,.953,.839);
void main(){
  if(uT<vN) discard;
  float a=1.-smoothstep(.35,1.,abs(vS));
  float age=uT-vN;
  float pointe=1.+2.2*exp(-age*14.);                         // la pointe qui court est plus vive
  float naissance=smoothstep(0.,.025,age);
  float lacher=1.-smoothstep(12.82,13.05,uT);                // une fois les éclats partis, ce sont leurs tranches qu'on voit
  float k=vK*(.55+.45*exp(-vR*.35))*(.25+1.1*smoothstep(.25,.8,vn(vQ*6.3))+.35*vn(vQ*23.));   // le trait accroche la lumière par endroits
  vec3 c=mix(ORP,INC,.55+.35*exp(-age*6.))*k*pointe;
  gl_FragColor=vec4(c*a*naissance*lacher*.95,1.);
}`;
const VS_FOND=`
varying vec2 vS;
void main(){ vS=position.xy; gl_Position=vec4(position.xy,1.,1.); }`;
const FS_FOND=`
precision highp float;
${VILLE}
uniform mat4 uInvVP; uniform vec3 uCam;
varying vec2 vS;
void main(){
  vec4 w=uInvVP*vec4(vS,1.,1.); vec3 rd=normalize(w.xyz/w.w-uCam);
  gl_FragColor=vec4(ville(uCam,rd),1.);
}`;
const VS_STD=`
varying vec3 vP, vN;
void main(){ vec4 w=modelMatrix*vec4(position,1.); vP=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`;
const FS_ACIER=`
precision highp float;
${VILLE}${LUM}
uniform vec3 uBase; uniform float uRug, uEmi;
varying vec3 vP, vN;
void main(){
  vec3 v=normalize(cameraPosition-vP), n=normalize(vN);
  if(uEmi>0.){ gl_FragColor=vec4(INC*uEmi,1.); return; }
  vec3 c=uBase*(eclaire(vP,n,v,uRug)+NUIT*.6)+ciel(reflect(-v,n))*.10*(1.-uRug*.5);
  gl_FragColor=vec4(c,1.);
}`;
const FS_BAIE=`
precision highp float;
${VILLE}
varying vec3 vP, vN;
void main(){ // la réception de la tour d'en face : une salle chaude, des montants de verre
  float z=vP.z, y=vP.y-80.;
  vec3 c=mix(BRAISE*.9, ORP*1.05, smoothstep(0.,4.,y))*(.75+.25*vn(vec2(z*1.3,y*.7)));
  c=mix(c, INC*1.2, exp(-pow(y-3.9,2.)*6.)*.6);               // la rampe de plafond
  float m=1.-smoothstep(.02,.05,abs(fract(z/1.2+.5)-.5)*1.2);
  c=mix(c, vec3(.05,.045,.04), m*.85);
  gl_FragColor=vec4(c*.85,1.);
}`;
const VS_POST=`varying vec2 vU; void main(){ vU=position.xy*.5+.5; gl_Position=vec4(position.xy,0.,1.); }`;
const GL_H12=`float h12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}`;
// flou de mouvement de la caméra : chaque pixel est reprojeté au début et à la fin de l'obturation (180°, 1/48 s)
const FS_MOUV=`
precision highp float;
uniform sampler2D uTex, uDep; uniform mat4 uInvVP, uVP0, uVP1; uniform vec2 uRes; uniform float uMax;
varying vec2 vU;
${GL_H12}
void main(){
  float d=min(texture2D(uDep,vU).r,.99999);
  vec4 w=uInvVP*vec4(vU*2.-1.,d*2.-1.,1.); vec3 P=w.xyz/w.w;
  vec4 a=uVP0*vec4(P,1.), b=uVP1*vec4(P,1.);
  vec2 v=(b.xy/b.w-a.xy/a.w)*.5;
  float L=length(v*uRes); if(L>uMax) v*=uMax/L;
  if(a.w<.02||b.w<.02||L<.6){ gl_FragColor=texture2D(uTex,vU); return; }
  float j=h12(vU*uRes)-.5; vec3 c=vec3(0.);
  for(int i=0;i<12;i++){ float k=(float(i)+.5+j)/12.-.5; c+=texture2D(uTex,vU+v*k).rgb; }
  gl_FragColor=vec4(c/12.,1.);
}`;
// profondeur de champ : un disque de diaphragme, échantillonné en spirale d'or (« scatter as gather », D. Gustafsson)
const FS_PDC=`
precision highp float;
uniform sampler2D uTex, uDep; uniform vec2 uRes; uniform float uF, uA, uMaxB, uNear, uFar;
varying vec2 vU;
${GL_H12}
float vz(float d){ float z=d*2.-1.; return 2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear)); }
float coc(float z){ return min(uA*abs(z-uF)/z, uMaxB); }
void main(){
  vec3 col=texture2D(uTex,vU).rgb;
  if(uA<.35){ gl_FragColor=vec4(col,1.); return; }
  float z0=vz(texture2D(uDep,vU).r), c0=coc(z0);
  float tot=1., rs=uMaxB*uMaxB/88., r=rs, ang=h12(gl_FragCoord.xy)*6.2832;
  for(int i=0;i<44;i++){
    if(r>=uMaxB) break;
    vec2 tc=vU+vec2(cos(ang),sin(ang))*r/uRes;
    float zs=vz(texture2D(uDep,tc).r); vec3 sc=texture2D(uTex,tc).rgb;
    float sz=coc(zs); if(zs>z0) sz=min(sz,c0*2.);
    float m=smoothstep(r-.5,r+.5,sz);
    col+=mix(col/tot,sc,m); tot+=1.; ang+=2.39996; r+=rs/r;
  }
  gl_FragColor=vec4(col/tot,1.);
}`;
// l'image composée : le décor (net ou flou), le verre par-dessus (toujours net : il est au point quand on le regarde),
// et l'air de la passerelle éclairé par ses lampes — diffusion simple, forme fermée (Sun et al. 2005) — et par les flashs
const FS_COMPO=`
precision highp float;
uniform sampler2D uTex, uVerre, uDep; uniform mat4 uInvVP; uniform vec3 uCam; uniform vec3 uLampes[8]; uniform vec4 uFlash; uniform float uSig;
varying vec2 vU;
float diffuse_(vec3 q, vec3 rd, float D){ float b=dot(q,rd); float h=sqrt(max(dot(q,q)-b*b,1e-4)); return (atan((D-b)/h)+atan(b/h))/h; }
void main(){
  vec3 c=texture2D(uTex,vU).rgb; vec4 g=texture2D(uVerre,vU);
  float d=min(texture2D(uDep,vU).r,.99999);
  vec4 w=uInvVP*vec4(vU*2.-1.,d*2.-1.,1.); vec3 P=w.xyz/w.w;
  vec3 rd=normalize(P-uCam); float D=min(length(P-uCam),160.);
  vec3 a=vec3(0.);
  for(int i=0;i<8;i++) a+=vec3(1.,.80,.55)*diffuse_(uLampes[i]-uCam,rd,D);
  if(uFlash.w>0.) a+=vec3(.92,.96,1.)*uFlash.w*.07*diffuse_(uFlash.xyz-uCam,rd,D);
  c=c*(1.-g.a)+g.rgb+a*uSig;
  gl_FragColor=vec4(c,1.);
}`;
// bloom physique : chaîne de réductions (filtre 13 points, Jimenez 2014) puis remontée en tente ; une fraction de l'énergie s'étale
const FS_BAS=`
precision highp float; uniform sampler2D uTex; uniform vec2 uTx; varying vec2 vU;
vec3 s(vec2 o){ return texture2D(uTex,vU+o*uTx).rgb; }
void main(){
  vec3 a=s(vec2(-2,2)),b=s(vec2(0,2)),c=s(vec2(2,2)),d=s(vec2(-2,0)),e=s(vec2(0,0)),f=s(vec2(2,0)),g=s(vec2(-2,-2)),h=s(vec2(0,-2)),i=s(vec2(2,-2));
  vec3 j=s(vec2(-1,1)),k=s(vec2(1,1)),l=s(vec2(-1,-1)),m=s(vec2(1,-1));
  vec3 o=e*.125+(a+c+g+i)*.03125+(b+d+f+h)*.0625+(j+k+l+m)*.125;
  gl_FragColor=vec4(min(o,vec3(40.)),1.);
}`;
const FS_HAUT=`
precision highp float; uniform sampler2D uTex; uniform vec2 uTx; varying vec2 vU;
vec3 s(vec2 o){ return texture2D(uTex,vU+o*uTx).rgb; }
void main(){
  vec3 o=s(vec2(0,0))*4.+(s(vec2(-1,0))+s(vec2(1,0))+s(vec2(0,-1))+s(vec2(0,1)))*2.+s(vec2(-1,-1))+s(vec2(1,-1))+s(vec2(-1,1))+s(vec2(1,1));
  gl_FragColor=vec4(o/16.,1.);
}`;
const FS_POST=`
precision highp float;
uniform sampler2D uTex, uBloom; uniform float uFondu, uT, uBl; uniform vec2 uRes;
varying vec2 vU;
float h12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
void main(){
  vec3 c=texture2D(uTex,vU).rgb;
  c=mix(c, texture2D(uBloom,vU).rgb, uBl);
  vec2 s=(vU-.5)*vec2(uRes.x/uRes.y,1.);
  float v=smoothstep(1.25,.35,length(s*vec2(.85,1.)));
  c*=mix(.62,1.,v);
  c=c/(1.+c*.18)*1.08;
  c*=uFondu;
  c+=(h12(vU*uRes+fract(uT*7.3)*vec2(131.,71.))-.5)*.022;
  gl_FragColor=vec4(max(c,0.),1.);
}`;


const VS_AIR=`varying vec3 vP; void main(){ vec4 w=modelMatrix*vec4(position,1.); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const FS_AIR=`
precision highp float;
varying vec3 vP;
const vec3 ORP=vec3(.91,.83,.545), BRAISE=vec3(.788,.467,.18);
void main(){ // l'air de la salle, chauffé par les lampes : un tube de lumière vu de dehors, une brume légère vu de dedans
  vec3 ro=cameraPosition, rd=normalize(vP-ro);
  vec3 a=vec3(20.,80.,-3.), b=vec3(60.,84.5,3.);
  vec3 iv=1./rd, t0=(a-ro)*iv, t1=(b-ro)*iv, tn=min(t0,t1), tf=max(t0,t1);
  float n0=max(max(tn.x,tn.y),tn.z), f0=min(min(tf.x,tf.y),tf.z);
  float L=max(f0-max(n0,0.),0.);
  bool dedans=all(greaterThan(ro,a))&&all(lessThan(ro,b));
  float k=(1.-exp(-L*.05))*(dedans?.10:.42);
  gl_FragColor=vec4(mix(BRAISE,ORP,.65)*k,1.);
}`;
const VS_POUDRE=`
attribute vec4 aV; attribute vec4 aQ;
uniform float uT, uPx;
varying float vI;
${GL_TAU}
void main(){
  float ti=tau(uT)-tau(aQ.x);
  vec3 p=position+aV.xyz*max(ti,0.)+vec3(0.,-4.905*ti*ti,0.)*step(0.,ti);
  vec4 c=projectionMatrix*viewMatrix*vec4(p,1.);
  gl_Position=c;
  float sc=uPx*aV.w;
  gl_PointSize=clamp(sc*7./max(c.w,.3),1.,5.);
  float g=pow(abs(sin(ti*aQ.y+aQ.z)),36.);
  vI=step(0.,ti)*(.32+1.8*g)*smoothstep(.4,1.2,c.w)*min(1.,2.2/max(gl_PointSize,1.));
}`;
const FS_POUDRE=`
precision highp float; varying float vI;
void main(){ vec2 d=gl_PointCoord-.5; float a=exp(-dot(d,d)*14.); gl_FragColor=vec4(vec3(1.,.93,.78)*vI*a,1.); }`;
function construitPoudre(){
  const P=[],V=[],Q=[];
  for(let i=0;i<900;i++){ const a=R()*6.283, r=Math.sqrt(R())*3.2;
    P.push(C.x+r*Math.cos(a)-.6, SOL-R()*.05, C.z+r*Math.sin(a)*.85);
    V.push((R()-.5)*1.4,-.2-R()*1.2+(R()<.35?1.1:0),(R()-.5)*1.4, .6+R()*1.2);
    Q.push(12.8+.05*r+R()*.12, 2+R()*9, R()*6.283, 0); }
  const G=new T3.BufferGeometry();
  G.setAttribute('position',new T3.Float32BufferAttribute(P,3));
  G.setAttribute('aV',new T3.Float32BufferAttribute(V,4));
  G.setAttribute('aQ',new T3.Float32BufferAttribute(Q,4));
  return G;
}
// ——— La caméra : Thomas marche, regarde ses pieds, tombe ———
function ressort(t,cles,w=7){ // somme de ressorts critiques : une fonction pure du temps
  let v=cles[0][1];
  for(let i=1;i<cles.length;i++){ const u=t-cles[i][0]; if(u>0) v+=(cles[i][1]-cles[i-1][1])*(1-(1+w*u)*Math.exp(-w*u)); }
  return v;
}
const DEG=Math.PI/180;
function camera(t){
  const tc=12.93;                                        // il passe à travers le verre
  const marche=clamp(t/9);
  let x=26+7.2*(1-Math.pow(1-marche,1.7));
  let vit=Math.pow(1-marche,.7);
  if(t<0){ const u=clamp(-t/15); x=26-4.8*(1-Math.pow(1-u,4.25)); vit=Math.pow(1-u,2.5); }   // avant : immobile au seuil, puis il s'avance (même vitesse à t = 0)
  let y=SOL+1.66+.006*Math.sin(t*2*Math.PI*1.7)*vit;
  let z=-.22+.06*Math.sin(t*.31);
  const sec=(ti,a)=>t<ti?0:a*Math.exp(-(t-ti)*6)*Math.sin((t-ti)*18);   // l'appui qui se dérobe, pas une secousse
  y-=sec(9.0,.010)+sec(10.3,.016)+sec(11.4,.022);
  // la flexion du plancher sous ses pieds
  const s=affaisse(Math.min(t,tc));
  const u=(((x-30)/2.5)%1+1)%1, w=(x>30&&x<40?1:0)*Math.pow(Math.sin(Math.PI*u),.7)*Math.cos(Math.PI/2*z/3)*Math.exp(-((x-C.x)**2+(z-C.z)**2)/8)*(front(Math.min(t,tc))>Math.hypot(x-C.x,z-C.z)-.05?1:0);
  y-=s*w;
  let pitch=ressort(t,[[0,-3],[7.8,-7],[8.55,-22],[9.05,-41],[10.35,-57],[11.45,-70],[12.35,-80]],6.5);
  let yaw=-Math.PI/2+ressort(t,[[0,0],[8.5,-3],[9.05,-9],[10.35,-4],[11.45,-7]],5)*DEG;
  let roll=0;
  if(t>tc){
    const ti=tau(t)-tau(tc);
    y-=4.905*ti*ti+.25*ti; x+=.18*ti; z+=.05*ti;
    // il bascule en arrière : le regard passe du vide à la passerelle qui s'éloigne
    const k=ss(13.15,15.05,t);
    pitch=lerp(pitch,78,k)+4*Math.sin(t*.7)*ss(15,17,t);
    roll=(-20*k-6*ss(15,18.4,t))*DEG;
    yaw+=(-14*k)*DEG;
  }
  return {p:[x,y,z],pitch:pitch*DEG,yaw,roll};
}

// ——— L'optique : mise au point (m) et ouverture (rayon du flou à l'infini, en pixels pour 1080 de haut) ———
// on marche : le point sur la réception d'en face ; il baisse les yeux : le point descend sur le verre sous ses pieds
// et la ville, 80 m plus bas, se défait en disques de lumière ; il tombe : le point sur les éclats autour de lui
function optique(t,k){
  const fy=Math.sin(k.pitch), fx=-Math.sin(k.yaw)*Math.cos(k.pitch);
  const loin=Math.max(5,(60-k.p[0])/Math.max(.35,fx));
  const pied=(k.p[1]-SOL)/Math.max(.2,-fy);
  const bas=ss(-.18,-.62,fy);
  let F=lerp(loin,Math.max(1.2,pied),bas), A=lerp(2.6,9.5,bas);
  const ch=ss(12.9,13.7,t); F=lerp(F,6.5,ch); A=lerp(A,6.,ch);
  A*=1-ss(17.6,18.4,t)*.5;
  return {F,A};
}
// ——— Construction de la scène ———
let rendu=null;
function init(canvas){
  const renderer=new T3.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.autoClear=false;
  renderer.outputColorSpace=T3.LinearSRGBColorSpace;
  const scene=new T3.Scene();
  const cam=new T3.PerspectiveCamera(56,16/9,.03,4000);
  cam.rotation.order='YXZ';
  const uCommun={uT:{value:0},uFoot:{value:.001},uLampes:{value:LAMPES},uFlash:{value:new T3.Vector4(0,0,0,0)}};
  const AJOUT={blending:T3.CustomBlending,blendSrc:T3.OneFactor,blendDst:T3.OneFactor,blendSrcAlpha:T3.ZeroFactor,blendDstAlpha:T3.OneFactor};
  const fond=new T3.Mesh(new T3.PlaneGeometry(2,2),new T3.ShaderMaterial({vertexShader:VS_FOND,fragmentShader:FS_FOND,
    uniforms:{...uCommun,uInvVP:{value:new T3.Matrix4()},uCam:{value:new T3.Vector3()}},depthTest:false,depthWrite:false}));
  fond.frustumCulled=false; fond.renderOrder=-10; scene.add(fond);
  const matAcier=(base,rug)=>new T3.ShaderMaterial({vertexShader:VS_STD,fragmentShader:FS_ACIER,uniforms:{...uCommun,uBase:{value:new T3.Vector3(...base)},uRug:{value:rug},uEmi:{value:0}}});
  const acier=matAcier([.15,.155,.165],.38), acierClair=matAcier([.24,.24,.25],.25);
  const boite=(x0,y0,z0,x1,y1,z1,m)=>{ const g=new T3.BoxGeometry(x1-x0,y1-y0,z1-z0); const me=new T3.Mesh(g,m); me.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); scene.add(me); return me; };
  // ossature : traverses du plancher (I), longerons de rive, montants, toit, main courante
  for(let x=20;x<=60.01;x+=2.5){
    boite(x-.08,SOL-EP-.30,-BZ-.05,x+.08,SOL-EP,BZ+.05,acier);          // âme et semelle
    boite(x-.025,SOL-EP-.02,-BZ,x+.025,SOL+.004,BZ,acierClair);          // le joint visible entre deux vitres
    for(const s of [-1,1]){ boite(x-.04,SOL,s*BZ-.05,x+.04,PLAF,s*BZ+.05,acier); }
    boite(x-.04,PLAF-.02,-BZ,x+.04,PLAF+.14,BZ,acier);
  }
  for(const s of [-1,1]){
    boite(20,SOL-.42,s*BZ-.10,60,SOL+.12,s*BZ+.10,acier);                 // longeron de rive
    boite(20,PLAF-.04,s*BZ-.08,60,PLAF+.16,s*BZ+.08,acier);
    const mc=new T3.Mesh(new T3.CylinderGeometry(.022,.022,40,10),acierClair); mc.rotation.z=Math.PI/2; mc.position.set(40,SOL+1.02,s*(BZ-.11)); scene.add(mc);
    for(let x=21.25;x<60;x+=2.5){ boite(x-.012,SOL+.12,s*(BZ-.11)-.012,x+.012,SOL+1.02,s*(BZ-.11)+.012,acierClair); }
  }
  // les filets lumineux au pied des parois, et les lampes suspendues
  const emi=new T3.ShaderMaterial({vertexShader:VS_STD,fragmentShader:FS_ACIER,uniforms:{...uCommun,uBase:{value:new T3.Vector3()},uRug:{value:0},uEmi:{value:1.1}}});
  const emiL=new T3.ShaderMaterial({vertexShader:VS_STD,fragmentShader:FS_ACIER,uniforms:{...uCommun,uBase:{value:new T3.Vector3()},uRug:{value:0},uEmi:{value:2.2}}});
  for(const s of [-1,1]) boite(20,SOL+.10,s*(BZ-.03)-.012,60,SOL+.125,s*(BZ-.03)+.012,emi);
  for(const L of LAMPES){ const b=new T3.Mesh(new T3.SphereGeometry(.055,16,12),emiL); b.position.copy(L); scene.add(b);
    boite(L.x-.004,L.y+.05,-.004,L.x+.004,PLAF,.004,acierClair);
    const cl=new T3.Mesh(new T3.CylinderGeometry(.03,.14,.12,20,1,true),acier); cl.position.set(L.x,L.y+.07,0); scene.add(cl); }
  // la baie de la réception, en face
  const baie=new T3.Mesh(new T3.PlaneGeometry(6,4.4),new T3.ShaderMaterial({vertexShader:VS_STD,fragmentShader:FS_BAIE,uniforms:{...uCommun}}));
  baie.rotation.y=-Math.PI/2; baie.position.set(59.98,SOL+2.2,0); scene.add(baie);
  // le verre
  const matVerre=new T3.ShaderMaterial({vertexShader:VS_ECLAT,fragmentShader:FS_VERRE,uniforms:{...uCommun},transparent:true,depthWrite:false,side:T3.DoubleSide,
    blending:T3.CustomBlending,blendSrc:T3.OneFactor,blendDst:T3.OneMinusSrcAlphaFactor,blendSrcAlpha:T3.OneFactor,blendDstAlpha:T3.OneMinusSrcAlphaFactor});
  const panneaux=new T3.Mesh(construitPanneaux(),matVerre); panneaux.frustumCulled=false; panneaux.renderOrder=1; scene.add(panneaux);
  const verre=new T3.Mesh(construitEclats(),matVerre); verre.frustumCulled=false; verre.renderOrder=2; scene.add(verre);
  const matF=new T3.ShaderMaterial({vertexShader:VS_FISS,fragmentShader:FS_FISS,uniforms:{...uCommun,uPx:{value:1.4},uRes:{value:new T3.Vector2(1,1)}},
    transparent:true,depthWrite:false,side:T3.DoubleSide,...AJOUT});
  const fiss=new T3.Mesh(construitFissures(),matF); fiss.frustumCulled=false; fiss.renderOrder=3; scene.add(fiss);
  const air=new T3.Mesh(new T3.BoxGeometry(40,4.5,6),new T3.ShaderMaterial({vertexShader:VS_AIR,fragmentShader:FS_AIR,
    transparent:true,depthWrite:false,depthTest:false,side:T3.BackSide,...AJOUT}));
  air.position.set(40,SOL+2.25,0); air.frustumCulled=false; air.renderOrder=0; scene.add(air);
  const matP=new T3.ShaderMaterial({vertexShader:VS_POUDRE,fragmentShader:FS_POUDRE,uniforms:{...uCommun,uPx:matF.uniforms.uPx},
    transparent:true,depthWrite:false,...AJOUT});
  const poudre=new T3.Points(construitPoudre(),matP); poudre.frustumCulled=false; poudre.renderOrder=4; scene.add(poudre);
  // ——— calques : 0 le décor (et le ciel), 1 le décor sans le ciel (pour la profondeur du calque de verre), 2 le verre ———
  scene.traverse(o=>{ if(!o.isMesh&&!o.isPoints) return;
    if(o===fond) o.layers.set(0);
    else if(o.material.transparent) o.layers.set(2);
    else o.layers.enable(1); });
  const profSeule=new T3.MeshBasicMaterial({colorWrite:false});
  // ——— passes d'image ———
  const sPost=new T3.Scene(), cPost=new T3.OrthographicCamera(-1,1,1,-1,0,1);
  const quad=new T3.Mesh(new T3.PlaneGeometry(2,2)); quad.frustumCulled=false; sPost.add(quad);
  const mat=(fs,u)=>new T3.ShaderMaterial({vertexShader:VS_POST,fragmentShader:fs,uniforms:u,depthTest:false,depthWrite:false});
  const mMouv=mat(FS_MOUV,{uTex:{value:null},uDep:{value:null},uInvVP:{value:new T3.Matrix4()},uVP0:{value:new T3.Matrix4()},uVP1:{value:new T3.Matrix4()},uRes:{value:new T3.Vector2()},uMax:{value:40}});
  const mPdc=mat(FS_PDC,{uTex:{value:null},uDep:{value:null},uRes:{value:new T3.Vector2()},uF:{value:10},uA:{value:0},uMaxB:{value:10},uNear:{value:.03},uFar:{value:4000}});
  const mCompo=mat(FS_COMPO,{uTex:{value:null},uVerre:{value:null},uDep:{value:null},uInvVP:{value:new T3.Matrix4()},uCam:{value:new T3.Vector3()},uLampes:{value:LAMPES},uFlash:uCommun.uFlash,uSig:{value:.0033}});
  const mBas=mat(FS_BAS,{uTex:{value:null},uTx:{value:new T3.Vector2()}});
  const mHaut=mat(FS_HAUT,{uTex:{value:null},uTx:{value:new T3.Vector2()}}); mHaut.blending=T3.AdditiveBlending;
  mHaut.blending=T3.CustomBlending; mHaut.blendSrc=T3.OneFactor; mHaut.blendDst=T3.OneFactor;
  const mFin=mat(FS_POST,{uTex:{value:null},uBloom:{value:null},uBl:{value:.045},uFondu:{value:1},uT:{value:0},uRes:{value:new T3.Vector2(1,1)}});
  const passe=(m,cible)=>{ quad.material=m; renderer.setRenderTarget(cible); renderer.render(sPost,cPost); };
  let W=0,H=0, rtA=null, rtB=null, rtM=null, rtP=null, rtC=null, mips=[];
  const plat=(w,h)=>new T3.WebGLRenderTarget(w,h,{type:T3.HalfFloatType,depthBuffer:false,minFilter:T3.LinearFilter,magFilter:T3.LinearFilter});
  function taille(w,h){
    if(w===W&&h===H&&rtA) return; W=w; H=h;
    renderer.setSize(w,h,false);
    [rtA,rtB,rtM,rtP,rtC,...mips].forEach(r=>r&&r.dispose());
    rtA=new T3.WebGLRenderTarget(w,h,{samples:4,type:T3.HalfFloatType,depthBuffer:true,depthTexture:new T3.DepthTexture(w,h)});
    rtB=new T3.WebGLRenderTarget(w,h,{samples:4,type:T3.HalfFloatType,depthBuffer:true});
    rtM=plat(w,h); rtP=plat(w,h); rtC=plat(w,h);
    mips=[]; let mw=w, mh=h; for(let i=0;i<6;i++){ mw=Math.max(1,mw>>1); mh=Math.max(1,mh>>1); mips.push(plat(mw,mh)); }
    mMouv.uniforms.uRes.value.set(w,h); mPdc.uniforms.uRes.value.set(w,h); mFin.uniforms.uRes.value.set(w,h);
    matF.uniforms.uRes.value.set(w,h); matF.uniforms.uPx.value=Math.max(1.1,h/1080*1.5);
  }
  const vp=new T3.Matrix4(), vpM=new T3.Matrix4(), cPrev=cam.clone();
  const vpDe=(t,m)=>{ const k=camera(t); cPrev.fov=cam.fov; cPrev.aspect=cam.aspect; cPrev.near=cam.near; cPrev.far=cam.far; cPrev.updateProjectionMatrix();
    cPrev.position.set(...k.p); cPrev.rotation.order='YXZ'; cPrev.rotation.set(k.pitch,k.yaw,k.roll); cPrev.updateMatrixWorld(); m.multiplyMatrices(cPrev.projectionMatrix,cPrev.matrixWorldInverse); };
  rendu=function(t,fondu){
    const asp=W/H, eH=H/1080;
    cam.fov=asp>=1?56:Math.min(86,2*Math.atan(Math.tan(31*DEG)/asp)/DEG);
    cam.aspect=asp; cam.updateProjectionMatrix();
    const k=camera(t);
    cam.position.set(...k.p); cam.rotation.set(k.pitch,k.yaw,k.roll); cam.updateMatrixWorld();
    uCommun.uT.value=t; uCommun.uFoot.value=2*Math.tan(cam.fov*DEG/2)/H*1.2;
    vpM.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse); vp.copy(vpM).invert();
    fond.material.uniforms.uInvVP.value.copy(vp); fond.material.uniforms.uCam.value.copy(cam.position);
    // le décor, puis le verre (sur la profondeur du décor, sans le ciel)
    renderer.setClearColor(0x000000,1); renderer.setRenderTarget(rtA); renderer.clear(); cam.layers.set(0); renderer.render(scene,cam);
    renderer.setClearColor(0x000000,0); renderer.setRenderTarget(rtB); renderer.clear();
    scene.overrideMaterial=profSeule; cam.layers.set(1); renderer.render(scene,cam); scene.overrideMaterial=null;
    cam.layers.set(2); renderer.render(scene,cam); cam.layers.set(0); renderer.setClearColor(0x000000,1);
    // la caméra : obturation 180° autour de t, puis mise au point
    const ob=1/96;
    vpDe(t-ob,mMouv.uniforms.uVP0.value); vpDe(t+ob,mMouv.uniforms.uVP1.value);
    mMouv.uniforms.uTex.value=rtA.texture; mMouv.uniforms.uDep.value=rtA.depthTexture; mMouv.uniforms.uInvVP.value.copy(vp);
    mMouv.uniforms.uMax.value=46*eH; passe(mMouv,rtM);
    const o=optique(t,k);
    mPdc.uniforms.uTex.value=rtM.texture; mPdc.uniforms.uDep.value=rtA.depthTexture; mPdc.uniforms.uF.value=o.F;
    mPdc.uniforms.uA.value=o.A*eH; mPdc.uniforms.uMaxB.value=Math.max(1,o.A*eH*1.05); mPdc.uniforms.uNear.value=cam.near; mPdc.uniforms.uFar.value=cam.far;
    passe(mPdc,rtP);
    mCompo.uniforms.uTex.value=rtP.texture; mCompo.uniforms.uVerre.value=rtB.texture; mCompo.uniforms.uDep.value=rtA.depthTexture;
    mCompo.uniforms.uInvVP.value.copy(vp); mCompo.uniforms.uCam.value.copy(cam.position); passe(mCompo,rtC);
    // bloom
    let src=rtC; for(const m of mips){ mBas.uniforms.uTex.value=src.texture; mBas.uniforms.uTx.value.set(1/src.width,1/src.height); passe(mBas,m); src=m; }
    for(let i=mips.length-1;i>0;i--){ mHaut.uniforms.uTex.value=mips[i].texture; mHaut.uniforms.uTx.value.set(1/mips[i].width,1/mips[i].height); passe(mHaut,mips[i-1]); }
    mFin.uniforms.uTex.value=rtC.texture; mFin.uniforms.uBloom.value=mips[0].texture; mFin.uniforms.uFondu.value=fondu; mFin.uniforms.uT.value=t;
    passe(mFin,null);
  };
  return {taille, rendu:(t,f)=>rendu(t,f), camera, nb:{eclats:eclats.length,fissures:fissures.length}};
}
window.Passerelle={init, camera, tau};
})();
