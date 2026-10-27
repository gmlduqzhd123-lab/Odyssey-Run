from pathlib import Path
p=Path('public/assets')
def svg(name,body,w=160,h=160):
 (p/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>')
ink='#19394b'; gold='#edb84c'; cream='#fff0cb'; teal='#277c80'
svg('compass',f'<circle cx="80" cy="80" r="68" fill="{ink}" stroke="{gold}" stroke-width="5"/><path d="M80 20 97 63 140 80 97 97 80 140 63 97 20 80 63 63Z" fill="{gold}"/><path d="m80 42 0 38 27 0Z" fill="{cream}"/><circle cx="80" cy="80" r="8" fill="{ink}"/>')
svg('star',f'<path d="m80 8 20 46 50 6-37 35 10 50-43-25-43 25 10-50-37-35 50-6Z" fill="{gold}" stroke="#b27830" stroke-width="6" stroke-linejoin="round"/><path d="m80 28 0 72-35 25 9-37-24-22 37-4Z" fill="#ffdf7b"/>')
svg('map',f'<path d="m25 28 39-13 36 16 34-13-6 112-30 15-38-16-39 14Z" fill="{cream}" stroke="#bb8845" stroke-width="7"/><path d="m64 18-4 111m40-98-6 111" fill="none" stroke="#d9b97f" stroke-width="4"/><path d="M40 100Q65 40 112 77" fill="none" stroke="{teal}" stroke-width="5" stroke-dasharray="8 6"/><path d="m106 63 17 22m-20-3 22-18" stroke="#c36d48" stroke-width="6"/>')
svg('shield',f'<path d="M80 12Q110 30 139 27L132 89Q126 124 80 149 34 124 28 89L21 27Q50 30 80 12Z" fill="{teal}" stroke="{gold}" stroke-width="9"/><path d="m80 35 10 30 31 0-25 19 10 30-26-18-26 18 10-30-25-19 31 0Z" fill="{gold}"/>')
svg('wings',f'<path d="M79 128C45 141 10 84 14 32Q40 53 61 58L48 13Q93 31 81 100 69 31 112 13L100 58Q125 54 148 32C152 84 117 141 81 128Z" fill="#f5eed8" stroke="#9dbaae" stroke-width="7"/><path d="m30 58 48 63m54-63-49 63M47 88l31 35m35-35-30 35" stroke="#c7d8c3" stroke-width="6"/>')
svg('magnet',f'<path d="M28 35v51a52 52 0 0 0 104 0V35h-29v51a23 23 0 0 1-46 0V35Z" fill="#c97256" stroke="{ink}" stroke-width="6"/><path d="M28 35h29v27H28Zm75 0h29v27h-29Z" fill="#f4dfb4"/><path d="m70 9 12 18 12-18m46 59 15 6m-145 0 15-6" fill="none" stroke="{gold}" stroke-width="7"/>')
svg('apple',f'<path d="M80 46C28 12 7 60 21 104c14 43 40 47 59 31 22 16 48 12 61-31 14-44-10-92-61-58Z" fill="{gold}" stroke="#af792d" stroke-width="6"/><path d="M81 48Q70 21 85 8" fill="none" stroke="#795a36" stroke-width="9"/><path d="M89 35Q100 6 132 19q-5 28-43 16" fill="#659d71"/><path d="M49 58Q28 75 39 96" fill="none" stroke="#ffdf83" stroke-width="9" stroke-linecap="round"/>')
# Expressive original character: frame-specific legs and cape, illustrated in one local SVG per state.
for state in ['run0','run1','run2','run3','jump','fall','slide','hurt','win']:
 phase=int(state[-1]) if state.startswith('run') else 0
 legs=[(52,128,80,131),(56,119,86,138),(69,132,47,132),(85,121,51,138)][phase]
 lx,ly,rx,ry=legs
 if state in ['jump','fall']: lx,ly,rx,ry=(45,118,87,119)
 if state=='win':lx,ly,rx,ry=(55,139,85,139)
 body=f'''<path d="M49 58Q18 62 {10+phase*3} 116L47 101 60 75" fill="#bf654d" stroke="#763f39" stroke-width="3"/><path d="M55 107  {lx} {ly}" stroke="#d59a6d" stroke-width="14" stroke-linecap="round"/><path d="M78 105 {rx} {ry}" stroke="#f1bc87" stroke-width="14" stroke-linecap="round"/><path d="m{lx-9} {ly+1} 18 0m{rx-9} {ry+1} 20 0" stroke="#694a35" stroke-width="8" stroke-linecap="round"/><path d="M48 61Q67 53 86 67l3 41Q65 120 41 106Z" fill="#f6e6bc" stroke="#a88450" stroke-width="3"/><path d="M50 64 62 95l21-29" fill="#367f82"/><path d="m44 96 44 0" stroke="#986940" stroke-width="7"/><path d="M84 70 98 91 112 78" fill="none" stroke="#e7af7f" stroke-width="13" stroke-linecap="round"/><path d="M105 81 121 54" stroke="#e5d4a2" stroke-width="7"/><path d="m110 77 14 7" stroke="#b48338" stroke-width="6"/><ellipse cx="68" cy="39" rx="26" ry="29" fill="#efb782"/><path d="M40 40Q31 3 70 6q34-1 28 37L76 27 44 40Z" fill="#dfb34f" stroke="#96702f" stroke-width="3"/><path d="M49 9Q45-10 66-13q32-1 40 32L82 10Z" fill="#b65745"/><path d="M43 31 45 58l10-4 0-23m34-4 3 27 10-5-5-24" fill="#dfb34f" stroke="#96702f" stroke-width="2"/><ellipse cx="78" cy="40" rx="3.2" ry="4.5" fill="#243c43"/><path d="m76 55 11-2" stroke="#81513b" stroke-width="2.5" stroke-linecap="round"/><path d="M57 15q15-10 28 1" stroke="#ffe3a1" stroke-width="4" fill="none"/>'''
 if state=='slide':body='''<path d="M60 109 17 143 79 141" fill="#bd654b" stroke="#764637" stroke-width="3"/><path d="m53 134 33-2 18 15m-52-11-9 13 31 0" fill="none" stroke="#efb782" stroke-width="13" stroke-linecap="round"/><path d="M51 116q20-18 41-4l-2 26H45Z" fill="#f1e1b5" stroke="#a88450" stroke-width="3"/><path d="m61 113 11 16 14-20" fill="#387b7d"/><circle cx="100" cy="113" r="20" fill="#efb782"/><path d="M78 110q-8-28 22-29 28-1 25 30l-23-10Z" fill="#ddb14e" stroke="#94722e" stroke-width="3"/><path d="M83 87q-3-17 13-18 24-2 34 18l-21-6Z" fill="#b55745"/><path d="m80 105 0 24 10-5v-21" fill="#e1b74e"/><circle cx="110" cy="115" r="3" fill="#233f46"/><path d="M87 129 111 136 129 127" fill="none" stroke="#efb782" stroke-width="9" stroke-linecap="round"/><path d="m121 130 15-16" stroke="#e7d4a5" stroke-width="6"/><path d="m42 150 30 0m25 0 22 0" stroke="#654a35" stroke-width="7" stroke-linecap="round"/>'''
 else:body='<g transform="translate(3 12) scale(.93)">'+body+'</g>'
 if state=='hurt':body+='<path d="m115 20 9 11 15-4-5 15 10 12-17-1-9 12-3-16-14-7 15-6Z" fill="#ffcd5d"/>'
 if state=='win':body+='<path d="m15 25 5-12m94 102 14 0m-8-5 0 12" stroke="#ffe6a1" stroke-width="4"/>'
 svg('hero-'+state,body,144,160)
svg('crate','<path d="m9 16 112-6 29 19-4 115-116 6-21-20Z" fill="#b77d49" stroke="#654c37" stroke-width="6"/><path d="m16 27 108-5-4 112-98 6Z" fill="#d39b59"/><path d="m20 32 94 96m-89 4 89-101" stroke="#835a37" stroke-width="17"/><path d="m19 32 95 96m-89 4 89-101" stroke="#e6b576" stroke-width="9"/><path d="m125 27 17-3-6 111-13 4Z" fill="#805d3d"/>')
svg('pillar','<path d="M28 14h106v20H28Zm9 21h87v99H37Zm-9 99h106v18H28Z" fill="#e4dcc1" stroke="#9c9d8c" stroke-width="5"/><path d="M54 41v85m20-85v85m24-85v85" stroke="#b6b9a8" stroke-width="8"/><path d="M34 21h94M36 142h92" stroke="#fff2d5" stroke-width="5"/>')
svg('gate','<path d="M0 0h160v126H0Z" fill="#a7b7ac"/><path d="M0 0h160v18H0ZM0 112h160v14H0Z" fill="#d7dfc7"/><path d="M0 39h160M0 78h160M40 18v21m80 0v39M55 78v34" stroke="#78988e" stroke-width="5"/><path d="m12 97 12-13 12 13m83 0 12-13 12 13" fill="none" stroke="#f1df9a" stroke-width="5"/>',160,126)
svg('rock','<path d="m22 44 39-33 54 11 36 62-25 53-94 9-25-55Z" fill="#767c83" stroke="#444d5c" stroke-width="6"/><path d="m61 11 2 63 51-52M63 74l63 63-94 9Z" fill="#999a94"/><path d="m63 74 88 10-37-62Z" fill="#686d7a"/>')
svg('boat','<path d="M23 119Q132 144 264 116l-28 44Q110 189 38 150Z" fill="#a56c43" stroke="#5c5140" stroke-width="5"/><path d="M35 128q115 26 216-1" stroke="#e4ba72" stroke-width="7" fill="none"/><path d="M147 19v113" stroke="#735d40" stroke-width="7"/><path d="M139 22Q62 53 61 111l77-9Z" fill="#fae7b6" stroke="#cda76e" stroke-width="3"/><path d="M155 38q56 38 63 76l-63-12Z" fill="#d78a62"/><path d="m162 13 29 5-29 10Z" fill="#d8a74b"/>',290,190)
svg('giant','<path d="M30 234Q0 148 51 109L36 50Q30 2 90 4t58 46l-10 59q55 44 31 125Z" fill="#5b5c73"/><ellipse cx="91" cy="60" rx="27" ry="20" fill="#dfcfac"/><circle cx="97" cy="61" r="12" fill="#b97a4a"/><circle cx="99" cy="62" r="6" fill="#25374a"/><path d="M65 103q29 15 56-3" stroke="#292d46" stroke-width="7" fill="none"/><path d="M42 144 5 183m136-37 38 40" stroke="#5b5c73" stroke-width="28" stroke-linecap="round"/>',185,240)
# Three complete original palettes and three parallax layers per stage.
for stage,top,bottom,sea,mountain in [('beach','#bdded9','#f6edd4','#378c98','#79afad'),('cave','#181f3b','#4d4c67','#3c6276','#53536e'),('wind','#9cbdce','#e4dfc3','#5f96ac','#87a5b2'),('sea','#a9d5ec','#f4eedb','#2c7ba4','#86a8b8')]:
 sky=f'<defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient></defs><path fill="url(#s)" d="M0 0h1600v540H0Z"/>'
 if stage!='cave':sky+='<circle cx="1130" cy="138" r="63" fill="#fff4d2"/><circle cx="1130" cy="138" r="86" fill="#fff4d2" opacity=".16"/>'
 else: sky+='<g fill="#b2afbe" opacity=".5">'+''.join(f'<circle cx="{i*137%1600}" cy="{30+i*39%240}" r="2"/>' for i in range(30))+'</g>'
 svg(stage+'-sky',sky,1600,540)
 far=''
 if stage=='cave':
  far=f'<path d="M0 0h1600v127l-100-65-80 127-130-139-120 201-160-164-109 103-120-150-100 116L500 38 410 193 300 45 190 149 72 78 0 153Z" fill="{mountain}"/>'
  far+='<path d="m0 440 90-135 130 59 90-176 150 155 150-80 130 100 150-163 200 160 90-130 180 70 110-132v267Z" fill="#393f5b"/>'
 elif stage=='sea':
  # The Sirens' sea: distant rocky islets with winged statues and open water.
  for x,w,h in [(60,260,120),(520,180,90),(900,320,140),(1360,210,100)]:
   far+=f'<path d="M{x} 363q{w*.2:.0f}-{h} {w*.45:.0f}-{h*.9:.0f} {w*.3:.0f}-{h*.25:.0f} {w*.55:.0f} {h*.9:.0f}Z" fill="{mountain}" opacity=".7"/>'
   cx=x+w*.45
   top=363-h*.9
   far+=f'<path d="M{cx-16:.0f} {top:.0f}v-22m11 22v-22m11 22v-22m11 22v-22M{cx-21:.0f} {top-22:.0f}h42" stroke="#eef0e6" stroke-width="4" fill="none" opacity=".5"/>'
  for x,y in [(240,110),(760,70),(1180,140)]:far+=f'<path d="M{x} {y}q25-28 57-10 29-26 52 9 32-2 38 13H{x}Z" fill="#f8f3dd" opacity=".6"/>'
  far+=f'<path d="M0 363h1600v177H0Z" fill="{sea}"/>'
 else:
  far=f'<path d="M0 352Q75 321 155 341l103-90 108 34 120-107 161 115 100-23 118 69 130-126 162 91 151-123 132 103 160 62v80H0Z" fill="{mountain}" opacity=".65"/>'
  for x,y in [(110,90),(480,150),(880,75),(1380,162)]:far+=f'<path d="M{x} {y}q25-28 57-10 29-26 52 9 32-2 38 13H{x}Z" fill="#f8f3dd" opacity=".6"/>'
  far+=f'<path d="M0 363h1600v177H0Z" fill="{sea}"/>'
 svg(stage+'-far',far,1600,540)
 mid=''
 if stage=='cave':
  for x in [100,430,810,1210,1480]:mid+=f'<path d="m{x} 425 28-139 65-32 37 171Z" fill="#484a60"/><path d="m{x+38} 318 17-36 17 36-17 15Z" fill="#eab467"/><path d="m{x+43} 316 12-22 11 22-12 8Z" fill="#fff0b0"/>'
 elif stage=='sea':
  mid='<path d="M0 430q90-24 180-6 110 20 210-8l160 18 150-22 160 24 170-26 150 20 180-16 240 22v104H0Z" fill="#2a6f8f" opacity=".6"/>'
  for x in [60,640,1240]:
   mid+=f'<path d="M{x} 425v-95h40v-30h120v30h40v95h-55v-55a45 45 0 0 0-90 0v55Z" fill="#d9d6c2" stroke="#9ea79c" stroke-width="3"/>'
   mid+=f'<path d="M{x+108} 300h24l-4-30h-16Z" fill="#e9e8da" stroke="#a9b0a4" stroke-width="2"/><circle cx="{x+120}" cy="262" r="8" fill="#e9e8da" stroke="#a9b0a4" stroke-width="2"/><path d="M{x+112} 278q-34-6-44-34 22 6 40 24M{x+128} 278q34-6 44-34-22 6-40 24" fill="#e9e8da" stroke="#a9b0a4" stroke-width="2"/>'
  mid+='<g stroke="#bfe0ea" fill="none" stroke-width="2" opacity=".45">'+''.join(f'<path d="M{x} {y}q20-8 40 0t40 0"/>' for y in [395,452,488] for x in range(30,1600,260))+'</g>'
 else:
  mid='<path d="M0 425q60-28 127-10 60 8 100-17l88 27 130-20 100 25 100-37 137 33 143-13 170 17 115-35 180 35 210-21v131H0Z" fill="#327789" opacity=".55"/>'
  for x in [70,670,1280]:
   mid+=f'<path d="m{x} 370 25-42 125 0 46 44Z" fill="#649794"/><path d="M{x+32} 327v-81h18v81m21 0v-81h18v81m21 0v-81h18v81m21 0v-81h18v81" stroke="#b6c4ae" stroke-width="3" fill="#dfdec0"/><path d="m{x+22} 245 65-34 75 34Z" fill="#ecdfb8"/><path d="M{x+20} 325h145v9H{x+20}Z" fill="#d3d0ac"/>'
  mid+='<g stroke="#b4d6cb" fill="none" stroke-width="2" opacity=".45">'+''.join(f'<path d="M{x} {y}h{80+x%80}"/>' for y in [388,413,465,490] for x in range(0,1600,230))+'</g>'
 svg(stage+'-mid',mid,1600,540)
