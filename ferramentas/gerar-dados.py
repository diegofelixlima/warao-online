import csv, json, re, unicodedata, sys
SRC='/mnt/project-files/vocabulario-warao/vocabulario-warao.csv'
OUT=sys.argv[1] if len(sys.argv)>1 else '.'
def norm(s): return ''.join(c for c in unicodedata.normalize('NFD',s.lower()) if unicodedata.category(c)!='Mn').replace('?','').replace('¿','').strip()
rows=list(csv.DictReader(open(SRC,encoding='utf-8-sig')))
# 21 grupos da aba "Variantes" (formas warao de cada grupo; 'contains' = casa como parte da frase)
G=[("Cinco",["Mojabasi","Muabasi"],None),
("Fome",["Nojeira","Nojera"],None),
("Cabeça",["Kua","Kuá"],None),
("Joelho",["Komukuru","Kamukuru"],None),
("Pé",["Komu","Omu"],"O próprio glossário traz as duas formas"),
("Bom dia",["Yakera yokonae","Yakera jokonera"],"Grafia ou variante dialetal"),
("Perna",["Moji","Kaja"],"Pode ser diferença de região ou de parte da perna"),
("Lixo",["Anana","Ajao","Ajab"],None),
("Ferida",["Bosi","Kabatanae"],"Bosi traduz \"llaga\"; Kabatanae traduz \"corte o herida\""),
("Remédio, medicamento",["Ibiji","Yarokota"],"O glossário usa as duas"),
("Irmão",["Dakobo","Daka","Daje"],"Dakobo = irmão; Daka = irmão pequeno/mais novo; Daje = irmão mais velho"),
("Onde fica o banheiro?",["Ka saba ine mikuna kiminoko isaka?","Kasaba bajiya jibonoko?"],None),
("Tu / ele (Iji)",["Iji","Iji nobaraya"],"Precisa de confirmação com falante"),
("Noboto",["Noboto"],"Glossário: criança pequena; cartilha: bebê"),
("Buratana",["Buratana"],"Glossário: tipo de banana (cambur); cartilha: banana"),
("Borracha (escolar)",["Jeberekoina","Jabata jeberekitane"],None),
("Onde (Kasaba)",["Kasaba","Kassaba","Ka saba"],"contains"),
("Pescoço",["Aro","Aaro"],None),
("Cunhado",["Bayaratu","Barayatu"],"Uma das duas é provavelmente erro de digitação"),
("Quatro",["Orabakaya","Orabakaja"],None),
("Vermes",["Kobejuba","Joba ji ajuba"],None)]
assert len(G)==21
out=[]; hits={g[0]:0 for g in G}
for r in rows:
    e=dict(id=int(r['ID']),warao=r['Warao'].strip(),pt=r['Português'].strip(),es=r['Espanhol'].strip(),
      categoria=r['Categoria'].strip(),fonte=r['Fonte'].strip(),pagina=r['Página'].strip(),
      status='revisar_falante' if r['Incerta'].strip()=='Sim' else 'provisoria',
      nota=r['Observação'].strip() or None, variantes=[])
    w=norm(e['warao'])
    for name,forms,com in G:
        nf=[norm(f) for f in forms]
        if com=='contains':
            m=any(re.search(r'(^| )'+re.escape(f)+r'( |$)',w) for f in nf)
        else:
            m=w in nf
        if m:
            hits[name]+=1
            e['variantes'].append(dict(conceito=name,formas=[f for f in forms if norm(f)!=w] if com!='contains' else forms,
                comentario=None if com=='contains' else com))
    out.append(e)
print('entradas',len(out),'revisar',sum(e['status']=='revisar_falante' for e in out))
print({k:v for k,v in hits.items()})
missing=[k for k,v in hits.items() if v==0]; print('sem entrada:',missing)
json.dump(out,open(OUT+'/dados/vocabulario.json','w',encoding='utf8'),ensure_ascii=False,indent=1)
open(OUT+'/dados/vocabulario.js','w',encoding='utf8').write('// Gerado a partir de vocabulario-warao.csv. Não edite à mão.\nwindow.DADOS = '+json.dumps(out,ensure_ascii=False)+';\n')
