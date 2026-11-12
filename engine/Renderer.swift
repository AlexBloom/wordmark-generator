import AppKit
import CoreText
import ImageIO
import UniformTypeIdentifiers
struct Request:Decodable {
 var names:[String];var count:Int?;var combine:Bool?;var fontDirectory:String?;var fontFiles:[String]?;var seed:Int?;var output:String?;var action:String?;var excludeFamilies:[String]?;var fonts:[String]?
}
struct FontInfo:Codable {let id:String;let family:String;let name:String;let source:String?}
struct Variant:Codable {let number:Int;let names:[String];let family:String;let font:String;let source:String?;let treatment:String;let svg:String;let png:String}
struct Manifest:Codable {let schemaVersion:Int;let names:[String];let count:Int;let uniqueFamilies:Int;let seed:Int;let variants:[Variant];let boards:[String];let licensing:String}
func emit<T:Encodable>(_ value:T)throws {let e=JSONEncoder();e.outputFormatting=[.prettyPrinted,.sortedKeys];let d=try e.encode(value);FileHandle.standardOutput.write(d);print("")}
func fail(_ s:String)->Never {FileHandle.standardError.write(Data((s+"\n").utf8));exit(1)}
guard CommandLine.arguments.count==2 else {fail("Usage: renderer request.json")}
let req:Request
do {req=try JSONDecoder().decode(Request.self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))} catch {fail("Invalid request: \(error.localizedDescription)")}
let fm=FileManager.default
var candidates:[(CTFont,FontInfo)]=[]
var paths=req.fontFiles ?? []
if let dir=req.fontDirectory {
 var isDir:ObjCBool=false
 guard fm.fileExists(atPath:dir,isDirectory:&isDir),isDir.boolValue else {fail("Font directory does not exist")}
 if let it=fm.enumerator(at:URL(fileURLWithPath:dir),includingPropertiesForKeys:nil,options:[.skipsHiddenFiles]) {for case let u as URL in it {if ["ttf","otf","ttc","otc","dfont"].contains(u.pathExtension.lowercased()) {paths.append(u.path)}}}
}
if paths.isEmpty && req.fontDirectory==nil && req.fontFiles==nil {
 for name in (CTFontManagerCopyAvailablePostScriptNames() as! [String]).sorted() {let f=CTFontCreateWithName(name as CFString,100,nil);candidates.append((f,FontInfo(id:name,family:CTFontCopyFamilyName(f) as String,name:name,source:nil)))}
} else {
 for path in Set(paths).sorted() {guard let ds=CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath:path) as CFURL) as? [CTFontDescriptor] else {continue};for d in ds {let f=CTFontCreateWithFontDescriptor(d,100,nil);let name=CTFontCopyPostScriptName(f) as String;candidates.append((f,FontInfo(id:name,family:CTFontCopyFamilyName(f) as String,name:name,source:path)))}}
}
let requested=req.names.filter{!$0.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty}
let allText=requested.joined()
var familySet=Set<String>()
let selected=Set(req.fonts ?? [])
let excluded=Set((req.excludeFamilies ?? []).map{$0.lowercased()})
candidates=candidates.filter {f,info in
 if !selected.isEmpty && !selected.contains(info.id) {return false}
 if excluded.contains(info.family.lowercased()) {return false}
 if !allText.isEmpty {let chars=Array(allText.utf16);var gs=[CGGlyph](repeating:0,count:chars.count);if !CTFontGetGlyphsForCharacters(f,chars,&gs,chars.count){return false}
 // Reject picture-only fonts. A wordmark needs actual letter outlines.
 if chars.enumerated().contains(where: {i,c in c != 32 && gs[i] == 0}) {return false}}
 return familySet.insert(info.family.lowercased()).inserted
}
if req.action=="fonts" {try emit(candidates.map{$0.1});exit(0)}
guard !requested.isEmpty && requested.count<=8 && requested.allSatisfy({$0.count<=100}) else {fail("Enter 1–8 names, each at most 100 characters")}
let count=req.count ?? 50
guard [10,50,100,250].contains(count) else {fail("Count must be 10, 50, 100, or 250")}
guard !candidates.isEmpty else {fail("No compatible font families found for these names")}
let seed=req.seed ?? 9000
var state=UInt64(truncatingIfNeeded:seed)&+1
func rand()->UInt64 {state=state &* 6364136223846793005 &+ 1442695040888963407;return state}
if candidates.count>1 {for i in stride(from:candidates.count-1,through:1,by:-1){candidates.swapAt(i,Int(rand()%UInt64(i+1)))}}
let out=req.output ?? "output"
try fm.createDirectory(atPath:out,withIntermediateDirectories:true)
struct Shape {let p:CGPath;let fill:Bool;let width:CGFloat}
func rect(_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat)->CGPath {CGPath(rect:CGRect(x:x,y:y,width:w,height:h),transform:nil)}
func ellipse(_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat)->CGPath {CGPath(ellipseIn:CGRect(x:x,y:y,width:w,height:h),transform:nil)}
func line(_ pts:[CGPoint],close:Bool=false)->CGPath {let p=CGMutablePath();if let a=pts.first{p.move(to:a);for b in pts.dropFirst(){p.addLine(to:b)};if close{p.closeSubpath()}};return p}
func textPath(_ text:String,_ font:CTFont)->CGPath {
 let a=NSAttributedString(string:text,attributes:[NSAttributedString.Key(kCTFontAttributeName as String):font]);let l=CTLineCreateWithAttributedString(a);let p=CGMutablePath()
 for r in CTLineGetGlyphRuns(l) as! [CTRun] {let rf=(CTRunGetAttributes(r) as NSDictionary)[kCTFontAttributeName] as! CTFont;let n=CTRunGetGlyphCount(r);var gs=[CGGlyph](repeating:0,count:n);var pos=[CGPoint](repeating:.zero,count:n);CTRunGetGlyphs(r,CFRange(location:0,length:0),&gs);CTRunGetPositions(r,CFRange(location:0,length:0),&pos)
 for i in 0..<n {if let g=CTFontCreatePathForGlyph(rf,gs[i],nil){let t=CGAffineTransform(translationX:pos[i].x,y:pos[i].y);p.addPath(g,transform:t)}}};return p
}
func fitted(_ p:CGPath,_ box:CGRect,stretch:Bool=false,slant:CGFloat=0)->CGPath {let b=p.boundingBoxOfPath;let sx=box.width/b.width;let sy=box.height/b.height;let s=min(sx,sy);let xx=stretch ? sx:s;let yy=stretch ? sy:s;var t=CGAffineTransform(a:xx,b:0,c:slant,d:-yy,tx:box.midX-b.midX*xx-b.midY*slant,ty:box.midY+b.midY*yy);return p.copy(using:&t)!}
func star(_ x:CGFloat,_ y:CGFloat,_ r:CGFloat,_ k:Int=4)->CGPath {var pts:[CGPoint]=[];for j in 0..<k*2 {let a=CGFloat(j)*CGFloat.pi/CGFloat(k)-CGFloat.pi/2;let rr=j%2==0 ? r:r*0.24;pts.append(CGPoint(x:x+cos(a)*rr,y:y+sin(a)*rr))};return line(pts,close:true)}
func svgPath(_ p:CGPath)->String {var s="";p.applyWithBlock{ptr in let e=ptr.pointee;let q=e.points;func xy(_ i:Int)->String {String(format:"%.2f %.2f",Double(q[i].x),Double(q[i].y))};switch e.type {case .moveToPoint:s+="M"+xy(0);case .addLineToPoint:s+="L"+xy(0);case .addQuadCurveToPoint:s+="Q"+xy(0)+" "+xy(1);case .addCurveToPoint:s+="C"+xy(0)+" "+xy(1)+" "+xy(2);case .closeSubpath:s+="Z";@unknown default:break}};return s}
func makeImage(_ w:Int,_ h:Int,_ draw:(CGContext)->Void)->CGImage {let c=CGContext(data:nil,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!;c.setFillColor(CGColor(gray:1,alpha:1));c.fill(CGRect(x:0,y:0,width:w,height:h));c.translateBy(x:0,y:CGFloat(h));c.scaleBy(x:1,y:-1);draw(c);return c.makeImage()!}
func savePNG(_ im:CGImage,_ file:String){let dst=CGImageDestinationCreateWithURL(URL(fileURLWithPath:file) as CFURL,UTType.png.identifier as CFString,1,nil)!;CGImageDestinationAddImage(dst,im,nil);CGImageDestinationFinalize(dst)}
func render(_ c:CGContext,_ sh:[Shape],inverse:Bool=false){c.setFillColor(CGColor(gray:inverse ? 1:0,alpha:1));c.setStrokeColor(CGColor(gray:inverse ? 1:0,alpha:1));for a in sh {c.addPath(a.p);if a.fill{c.fillPath()}else{c.setLineWidth(a.width);c.strokePath()}}}

let styles=["Natural","Stacked","Wide","Reverse","Open brackets","Underline","Outline","Monogram","Frame","Forward","Side rules","Offset"]
var variants:[Variant]=[];var images:[CGImage]=[]
for idx in 0..<count {
 let (font,info)=candidates[idx%candidates.count]
 let mode=(idx/candidates.count+idx)%styles.count
 let names=(req.combine ?? false) ? requested : [requested[idx%requested.count]]
 var shapes:[Shape]=[]
 func add(_ p:CGPath,_ fill:Bool=true,_ width:CGFloat=2){shapes.append(Shape(p:p,fill:fill,width:width))}
 func type(_ box:CGRect,_ stretch:Bool=false,_ slant:CGFloat=0){
  var lines=names
  if names.count==1 && mode != 0 && mode != 2 && mode != 6 {let words=names[0].split(separator:" ").map(String.init);if words.count>1 {let n=(words.count+1)/2;lines=[words.prefix(n).joined(separator:" "),words.dropFirst(n).joined(separator:" ")]}}
  let h=box.height/CGFloat(lines.count)
  for (i,s) in lines.enumerated(){let p=textPath(s,font);if !p.isEmpty {add(fitted(p,CGRect(x:box.minX,y:box.minY+CGFloat(i)*h,width:box.width,height:h*0.86),stretch:stretch,slant:slant))}}
 }
 let box=CGRect(x:70,y:130,width:760,height:340)
 switch mode {
 case 0:type(box)
 case 1:type(box)
 case 2:type(CGRect(x:70,y:190,width:760,height:200),true)
 case 3:type(box)
 case 4:type(CGRect(x:120,y:140,width:660,height:330));add(line([CGPoint(x:95,y:115),CGPoint(x:65,y:115),CGPoint(x:65,y:490),CGPoint(x:95,y:490)]),false,4);add(line([CGPoint(x:805,y:115),CGPoint(x:835,y:115),CGPoint(x:835,y:490),CGPoint(x:805,y:490)]),false,4)
 case 5:type(box);add(rect(100,500,700,3))
 case 6:let p=fitted(textPath(names.joined(separator:" "),font),CGRect(x:70,y:185,width:750,height:230));add(p,false,2)
 case 7:let initials=names.joined(separator:" ").split(separator:" ").prefix(2).compactMap{$0.first}.map(String.init).joined();add(fitted(textPath(initials,font),CGRect(x:50,y:210,width:190,height:180)));add(rect(270,145,2,320));type(CGRect(x:310,y:160,width:530,height:300))
 case 8:add(rect(45,75,810,450),false,2);type(CGRect(x:100,y:140,width:700,height:320))
 case 9:type(CGRect(x:90,y:150,width:700,height:300),false,0.12);for j in 0..<3{add(rect(110+CGFloat(j*25),490+CGFloat(j*9),650-CGFloat(j*25),CGFloat(4-j)))}
 case 10:type(CGRect(x:140,y:110,width:620,height:370));add(rect(90,110,8,360));add(rect(802,110,8,360))
 default:type(box);let copy=shapes;for a in copy {var t=CGAffineTransform(translationX:8,y:8);add(a.p.copy(using:&t)!,false,1)}
 }
 let inverse=mode==3
 let im=makeImage(1200,800){c in c.scaleBy(x:4/3,y:4/3);if inverse {c.setFillColor(CGColor(gray:0,alpha:1));c.fill(CGRect(x:25,y:60,width:850,height:480))};render(c,shapes,inverse:inverse)}
 let stem=String(format:"wordmark-%03d",idx+1);savePNG(im,out+"/"+stem+".png")
 let paths=shapes.map{"<path d=\"\(svgPath($0.p))\" fill=\"\($0.fill ? (inverse ? "white":"black"):"none")\" stroke=\"\($0.fill ? "none":(inverse ? "white":"black"))\" stroke-width=\"\($0.width)\"/>"}.joined(separator:"\n")
 let svg="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 900 600\"><rect width=\"900\" height=\"600\" fill=\"white\"/>"+(inverse ? "<rect x=\"25\" y=\"60\" width=\"850\" height=\"480\" fill=\"black\"/>":"")+paths+"</svg>"
 try svg.write(toFile:out+"/"+stem+".svg",atomically:true,encoding:.utf8)
 variants.append(Variant(number:idx+1,names:names,family:info.family,font:info.name,source:info.source,treatment:styles[mode],svg:stem+".svg",png:stem+".png"));images.append(im)
}
var boards:[String]=[]
for start in stride(from:0,to:count,by:20){let end=min(start+20,count);let rows=(end-start+3)/4;let im=makeImage(2400,rows*450){c in for i in start..<end {let x=CGFloat((i-start)%4)*600;let y=CGFloat((i-start)/4)*450;c.saveGState();c.translateBy(x:x,y:y);c.setStrokeColor(CGColor(gray:0.8,alpha:1));c.stroke(CGRect(x:0,y:0,width:600,height:450));c.saveGState();c.translateBy(x:0,y:420);c.scaleBy(x:1,y:-1);c.draw(images[i],in:CGRect(x:0,y:0,width:600,height:400));c.restoreGState();let f=CTFontCreateWithName("Helvetica" as CFString,20,nil);render(c,[Shape(p:fitted(textPath("\(i+1) · \(variants[i].family)",f),CGRect(x:20,y:8,width:560,height:22)),fill:true,width:0)]);c.restoreGState()}};let file=String(format:"board-%02d.png",start/20+1);savePNG(im,out+"/"+file);boards.append(file)}
let manifest=Manifest(schemaVersion:1,names:requested,count:count,uniqueFamilies:Set(variants.map{$0.family}).count,seed:seed,variants:variants,boards:boards,licensing:"Users are responsible for their own font licensing.")
let encoder=JSONEncoder();encoder.outputFormatting=[.prettyPrinted,.sortedKeys]
try encoder.encode(manifest).write(to:URL(fileURLWithPath:out+"/manifest.json"))
try emit(manifest)
