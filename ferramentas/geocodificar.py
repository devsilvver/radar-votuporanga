import json, urllib.request, urllib.parse, sys, time
def geo(s):
    u="https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?"+urllib.parse.urlencode({"SingleLine":s,"f":"json","outFields":"Match_addr,Addr_type","maxLocations":2,"countryCode":"BRA","location":"-49.975,-20.42"})
    r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"radar-map-script/1.0"}),timeout=30))
    return [(c["attributes"]["Match_addr"],c["attributes"]["Addr_type"],c["score"],round(c["location"]["y"],6),round(c["location"]["x"],6)) for c in r.get("candidates",[])]
Q=[l.strip() for l in open(sys.argv[1],encoding="utf8") if l.strip()]
out={}
for s in Q:
    out[s]=geo(s); print(s,"->",out[s][:2]); time.sleep(0.2)
json.dump(out,open(sys.argv[2],"w",encoding="utf8"),ensure_ascii=False,indent=1)
