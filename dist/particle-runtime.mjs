function as(t,e){let n=[];if(![800,1e3].includes(e))return["Choose MDX800 or MDX1000."];if(![800,1e3].includes(t?.Version))return["Only editable MDX800 and MDX1000 models can be converted."];if(e===t.Version)return n;if(e===800){for(let i of["ParticleEmitterPopcorns","FaceFX","BindPoses"])t[i]?.length&&n.push(`${i} cannot be represented in MDX800.`);for(let[i,r]of(t.Geosets||[]).entries()){for(let s of["SkinWeights","Tangents"])r[s]?.length&&n.push(`Geoset ${i+1} has ${s}.`);(r.LevelOfDetail>0||r.Name)&&n.push(`Geoset ${i+1} has authored level-of-detail data.`)}for(let[i,r]of(t.Materials||[]).entries()){r.Shader&&n.push(`Material ${i+1} uses a shader.`);for(let s of r.Layers||[]){for(let a of["NormalTextureID","ORMTextureID","EmissiveTextureID","TeamColorTextureID","ReflectionsTextureID"])s[a]!=null&&n.push(`Material ${i+1} uses ${a}.`);let o=(a,c)=>s[a]!=null&&(typeof s[a]=="object"||s[a]!==c);(o("EmissiveGain",1)||o("FresnelOpacity",0)||o("FresnelTeamColor",0)||s.ShaderTypeId>0)&&n.push(`Material ${i+1} has Reforged lighting properties.`),s.FresnelColor&&(s.FresnelColor.Keys||Array.from(s.FresnelColor).some(a=>a!==1))&&n.push(`Material ${i+1} has a Fresnel color.`)}}}return[...new Set(n)]}function Wi(t,e){if(t.Version=e,e===1e3)for(let n of t.Geosets||[])n.LevelOfDetail==null&&(n.LevelOfDetail=0);if(e===800){for(let n of t.Geosets||[])delete n.LevelOfDetail,delete n.Name;for(let n of t.Materials||[]){delete n.Shader;for(let i of n.Layers||[])for(let r of["EmissiveGain","FresnelColor","FresnelOpacity","FresnelTeamColor","ShaderTypeId"])delete i[r]}}}import{Buffer as ke}from"buffer";var ei=(function(t){return t[t.WrapWidth=1]="WrapWidth",t[t.WrapHeight=2]="WrapHeight",t})({}),wt=(function(t){return t[t.None=0]="None",t[t.Transparent=1]="Transparent",t[t.Blend=2]="Blend",t[t.Additive=3]="Additive",t[t.AddAlpha=4]="AddAlpha",t[t.Modulate=5]="Modulate",t[t.Modulate2x=6]="Modulate2x",t})({}),Ne=(function(t){return t[t.DontInterp=0]="DontInterp",t[t.Linear=1]="Linear",t[t.Hermite=2]="Hermite",t[t.Bezier=3]="Bezier",t})({}),qt=(function(t){return t[t.Unshaded=1]="Unshaded",t[t.SphereEnvMap=2]="SphereEnvMap",t[t.TwoSided=16]="TwoSided",t[t.Unfogged=32]="Unfogged",t[t.NoDepthTest=64]="NoDepthTest",t[t.NoDepthSet=128]="NoDepthSet",t})({}),Jn=(function(t){return t[t.ConstantColor=1]="ConstantColor",t[t.SortPrimsFarZ=16]="SortPrimsFarZ",t[t.FullResolution=32]="FullResolution",t})({}),hs=(function(t){return t[t.DropShadow=1]="DropShadow",t[t.Color=2]="Color",t})({}),Pe=(function(t){return t[t.DontInheritTranslation=1]="DontInheritTranslation",t[t.DontInheritRotation=2]="DontInheritRotation",t[t.DontInheritScaling=4]="DontInheritScaling",t[t.Billboarded=8]="Billboarded",t[t.BillboardedLockX=16]="BillboardedLockX",t[t.BillboardedLockY=32]="BillboardedLockY",t[t.BillboardedLockZ=64]="BillboardedLockZ",t[t.CameraAnchored=128]="CameraAnchored",t})({}),Zt=(function(t){return t[t.Helper=0]="Helper",t[t.Bone=256]="Bone",t[t.Light=512]="Light",t[t.EventObject=1024]="EventObject",t[t.Attachment=2048]="Attachment",t[t.ParticleEmitter=4096]="ParticleEmitter",t[t.CollisionShape=8192]="CollisionShape",t[t.RibbonEmitter=16384]="RibbonEmitter",t})({}),gt=(function(t){return t[t.Box=0]="Box",t[t.Sphere=2]="Sphere",t})({}),ji=(function(t){return t[t.EmitterUsesMDL=32768]="EmitterUsesMDL",t[t.EmitterUsesTGA=65536]="EmitterUsesTGA",t})({}),$t=(function(t){return t[t.Unshaded=32768]="Unshaded",t[t.SortPrimsFarZ=65536]="SortPrimsFarZ",t[t.LineEmitter=131072]="LineEmitter",t[t.Unfogged=262144]="Unfogged",t[t.ModelSpace=524288]="ModelSpace",t[t.XYQuad=1048576]="XYQuad",t})({}),on=(function(t){return t[t.Blend=0]="Blend",t[t.Additive=1]="Additive",t[t.Modulate=2]="Modulate",t[t.Modulate2x=3]="Modulate2x",t[t.AlphaKey=4]="AlphaKey",t})({}),Ve=(function(t){return t[t.Head=1]="Head",t[t.Tail=2]="Tail",t})({}),Qn=(function(t){return t[t.Omnidirectional=0]="Omnidirectional",t[t.Directional=1]="Directional",t[t.Ambient=2]="Ambient",t})({}),an=(function(t){return t[t.Unshaded=32768]="Unshaded",t[t.SortPrimsFarZ=65536]="SortPrimsFarZ",t[t.Unfogged=262144]="Unfogged",t})({});var La={TextureID:0,NormalTextureID:1,ORMTextureID:2,EmissiveTextureID:3,TeamColorTextureID:4,ReflectionsTextureID:5},Yt=["TextureID","NormalTextureID","ORMTextureID","EmissiveTextureID","TeamColorTextureID","ReflectionsTextureID"],Fa=class{constructor(t){this.str=t,this.pos=0}char(){return this.pos>=this.str.length&&J(this,"incorrect model data"),this.str[this.pos]}};function J(t,e=""){throw new Error(`SyntaxError, near ${t.pos}`+(e?", "+e:""))}function Ji(t){if(t.char()==="/"&&t.str[t.pos+1]==="/"){for(t.pos+=2;t.pos<t.str.length&&t.str[++t.pos]!==`
`;);return++t.pos,!0}return!1}var Da=/\s/i;function Rt(t){for(;t.pos<t.str.length&&Da.test(t.char());)++t.pos}var Ua=/[a-z]/i,Na=/[a-z0-9]/i;function z(t){if(!Ua.test(t.char()))return null;let e=t.char();for(++t.pos;Na.test(t.char());)e+=t.str[t.pos++];return Rt(t),e}function ie(t,e){t.char()===e&&(++t.pos,Rt(t))}function E(t,e){t.char()!==e&&J(t,`extected ${e}`),++t.pos,Rt(t)}function ge(t){if(t.char()==='"'){let e=++t.pos;for(;t.char()!=='"';)++t.pos;++t.pos;let n=t.str.substring(e,t.pos-1);return Rt(t),n}return null}var Ba=/[-0-9]/,Oa=/[-+.0-9e]/i;function k(t){if(Ba.test(t.char())){let e=t.pos;for(++t.pos;Oa.test(t.char());)++t.pos;let n=parseFloat(t.str.substring(e,t.pos));return Rt(t),n}return null}function ce(t,e,n){if(t.char()!=="{")return null;for(e||(e=[],n=0),E(t,"{");t.char()!=="}";){let i=k(t);i===null&&J(t,"expected number"),e[n++]=i,ie(t,",")}return E(t,"}"),e}function Va(t,e,n){if(t.char()!=="{")return 0;let i=n;for(E(t,"{");t.char()!=="}";){let r=k(t);r===null&&J(t,"expected number"),e[n++]=r,ie(t,",")}return E(t,"}"),n-i}function Xi(t,e){if(t.char()!=="{")return e[0]=k(t),e;let n=0;for(E(t,"{");t.char()!=="}";){let i=k(t);i===null&&J(t,"expected number"),e[n++]=i,ie(t,",")}return E(t,"}"),e}function Un(t){let e=null,n={};for(t.char()!=="{"&&(e=ge(t),e===null&&(e=k(t)),e===null&&J(t,"expected string or number")),E(t,"{");t.char()!=="}";){let i=z(t);i||J(t),i==="Interval"?n[i]=ce(t,new Uint32Array(2),0):i==="MinimumExtent"||i==="MaximumExtent"?n[i]=ce(t,new Float32Array(3),0):(n[i]=ce(t)||ge(t),n[i]===null&&(n[i]=k(t))),ie(t,",")}return E(t,"}"),[e,n]}function Ga(t,e){let[n,i]=Un(t);i.FormatVersion&&(e.Version=i.FormatVersion)}function ka(t,e){let[n,i]=Un(t);e.Info=i,e.Info.Name=n}function za(t,e){k(t),E(t,"{");let n=[];for(;t.char()!=="}";){z(t);let[i,r]=Un(t);r.Name=i,r.NonLooping="NonLooping"in r,r.MoveSpeed=r.MoveSpeed||0,r.Rarity=r.Rarity||0,n.push(r)}E(t,"}"),e.Sequences=n}function Ha(t,e){let n=[];for(k(t),E(t,"{");t.char()!=="}";){z(t);let[i,r]=Un(t);r.Flags=0,"WrapWidth"in r&&(r.Flags+=ei.WrapWidth,delete r.WrapWidth),"WrapHeight"in r&&(r.Flags+=ei.WrapHeight,delete r.WrapHeight),n.push(r)}E(t,"}"),e.Textures=n}var W=(function(t){return t[t.INT1=0]="INT1",t[t.FLOAT1=1]="FLOAT1",t[t.FLOAT3=2]="FLOAT3",t[t.FLOAT4=3]="FLOAT4",t})(W||{}),Wa={[W.INT1]:1,[W.FLOAT1]:1,[W.FLOAT3]:3,[W.FLOAT4]:4};function Xa(t,e,n,i){let r={Frame:e,Vector:null},s=n===W.INT1?Int32Array:Float32Array,o=Wa[n];return r.Vector=Xi(t,new s(o)),E(t,","),(i===Ne.Hermite||i===Ne.Bezier)&&(z(t),r.InTan=Xi(t,new s(o)),E(t,","),z(t),r.OutTan=Xi(t,new s(o)),E(t,",")),r}function pe(t,e){let n={LineType:Ne.DontInterp,GlobalSeqId:null,Keys:[]};k(t),E(t,"{");let i=z(t);for((i==="DontInterp"||i==="Linear"||i==="Hermite"||i==="Bezier")&&(n.LineType=Ne[i]),E(t,",");t.char()!=="}";){let r=z(t);if(r==="GlobalSeqId")n[r]=k(t),E(t,",");else{let s=k(t);s===null&&J(t,"expected frame number or GlobalSeqId"),E(t,":"),n.Keys.push(Xa(t,s,e,n.LineType))}}return E(t,"}"),n}function qa(t,e){let n={Alpha:null,TVertexAnimId:null,Shading:0,CoordId:0};for(E(t,"{");t.char()!=="}";){let i=z(t),r=!1;if(i||J(t),i==="static"&&(r=!0,i=z(t)),!r&&(i==="TextureID"||e.Version>=1100&&i in La))n[i]=pe(t,W.INT1);else if(!r&&i==="Alpha")n[i]=pe(t,W.FLOAT1);else if(i==="Unshaded"||i==="SphereEnvMap"||i==="TwoSided"||i==="Unfogged"||i==="NoDepthTest"||i==="NoDepthSet")n.Shading|=qt[i];else if(i==="FilterMode"){let s=z(t);(s==="None"||s==="Transparent"||s==="Blend"||s==="Additive"||s==="AddAlpha"||s==="Modulate"||s==="Modulate2x")&&(n.FilterMode=wt[s])}else if(i==="TVertexAnimId")n.TVertexAnimId=k(t);else if(e.Version>=900&&i==="EmissiveGain")r?n[i]=k(t):n[i]=pe(t,W.FLOAT1);else if(e.Version>=1e3&&i==="FresnelColor")r?n[i]=ce(t,new Float32Array(3),0):n[i]=pe(t,W.FLOAT3);else if(e.Version>=1e3&&(i==="FresnelOpacity"||i==="FresnelTeamColor"))r?n[i]=k(t):n[i]=pe(t,W.FLOAT1);else{let s=k(t);s===null&&(s=z(t)),n[i]=s}ie(t,","),Ji(t),Rt(t)}return E(t,"}"),n}function $a(t,e){let n=[];for(k(t),E(t,"{");t.char()!=="}";){let i={RenderMode:0,Layers:[]};for(z(t),E(t,"{");t.char()!=="}";){let r=z(t);if(r||J(t),r==="Layer")i.Layers.push(qa(t,e));else if(r==="PriorityPlane"||r==="RenderMode")i[r]=k(t);else if(r==="ConstantColor"||r==="SortPrimsFarZ"||r==="FullResolution")i.RenderMode|=Jn[r];else if(e.Version>=900&&e.Version<=1100&&r==="Shader")i[r]=ge(t);else throw new Error("Unknown material property "+r);ie(t,",")}E(t,"}"),n.push(i)}E(t,"}"),e.Materials=n}var In=(function(t){return t[t.INT=0]="INT",t[t.FLOAT=1]="FLOAT",t})(In||{});function qi(t,e,n){let i=k(t),r=new(n===In.FLOAT?Float32Array:Uint8Array)(i*e);E(t,"{");for(let s=0;s<i;++s)ce(t,r,s*e),E(t,",");return E(t,"}"),r}function Ya(t,e){let n={Vertices:null,Normals:null,TVertices:[],VertexGroup:new Uint8Array(0),Faces:null,Groups:null,TotalGroupsCount:null,MinimumExtent:null,MaximumExtent:null,BoundsRadius:0,Anims:[],MaterialID:null,SelectionGroup:null,Unselectable:!1};for(E(t,"{");t.char()!=="}";){let i=z(t);if(i||J(t),i==="Vertices"||i==="Normals"||i==="TVertices"){let r=3;i==="TVertices"&&(r=2);let s=qi(t,r,In.FLOAT);i==="TVertices"?n.TVertices.push(s):n[i]=s}else if(i==="VertexGroup")n[i]=new Uint8Array(n.Vertices.length/3),ce(t,n[i],0);else if(i==="Faces"){let r=k(t),s=k(t),o=0;n.Faces=new Uint16Array(s),E(t,"{"),z(t)!=="Triangles"&&J(t,"unexpected faces type"),E(t,"{");for(let a=0;a<r;++a){let c=Va(t,n.Faces,o);c||J(t,"expected array"),o+=c,ie(t,",")}(o!==s||s%3!==0)&&J(t,"mismatched faces array"),E(t,"}"),E(t,"}")}else if(i==="Groups"){let r=[];for(k(t),n.TotalGroupsCount=k(t),E(t,"{");t.char()!=="}";)z(t),r.push(ce(t)),ie(t,",");E(t,"}"),n.Groups=r}else if(i==="MinimumExtent"||i==="MaximumExtent")n[i]=ce(t,new Float32Array(3),0),E(t,",");else if(i==="BoundsRadius"||i==="MaterialID"||i==="SelectionGroup")n[i]=k(t),E(t,",");else if(i==="Anim"){let[r,s]=Un(t);s.Alpha===void 0&&(s.Alpha=1),n.Anims.push(s)}else i==="Unselectable"?(n.Unselectable=!0,E(t,",")):e.Version>=900&&(i==="LevelOfDetail"?(n.LevelOfDetail=k(t),E(t,",")):i==="Name"?(n.Name=ge(t),E(t,",")):i==="Tangents"?n.Tangents=qi(t,4,In.FLOAT):i==="SkinWeights"&&(n.SkinWeights=qi(t,8,In.INT)))}E(t,"}"),e.Geosets.push(n)}function Ka(t,e){let n={GeosetId:-1,Alpha:1,Color:null,Flags:0};for(E(t,"{");t.char()!=="}";){let i=z(t),r=!1;if(i||J(t),i==="static"&&(r=!0,i=z(t)),i==="Alpha")r?n.Alpha=k(t):n.Alpha=pe(t,W.FLOAT1);else if(i==="Color")if(r)n.Color=ce(t,new Float32Array(3),0),n.Color.reverse();else{n.Color=pe(t,W.FLOAT3);for(let s of n.Color.Keys)s.Vector.reverse(),s.InTan&&(s.InTan.reverse(),s.OutTan.reverse())}else i==="DropShadow"?n.Flags|=hs[i]:n[i]=k(t);ie(t,",")}E(t,"}"),e.GeosetAnims.push(n)}function Qi(t,e,n){let i={Name:ge(t),ObjectId:null,Parent:null,PivotPoint:null,Flags:Zt[e]};for(E(t,"{");t.char()!=="}";){let r=z(t);if(r||J(t),r==="Translation"||r==="Rotation"||r==="Scaling"||r==="Visibility"){let s=W.FLOAT3;r==="Rotation"?s=W.FLOAT4:r==="Visibility"&&(s=W.FLOAT1),i[r]=pe(t,s)}else if(r==="BillboardedLockZ"||r==="BillboardedLockY"||r==="BillboardedLockX"||r==="Billboarded"||r==="CameraAnchored")i.Flags|=Pe[r];else if(r==="DontInherit"){E(t,"{");let s=z(t);s==="Translation"?i.Flags|=Pe.DontInheritTranslation:s==="Rotation"?i.Flags|=Pe.DontInheritRotation:s==="Scaling"&&(i.Flags|=Pe.DontInheritScaling),E(t,"}")}else if(r==="Path")i[r]=ge(t);else{let s=z(t)||k(t);(r==="GeosetId"&&s==="Multiple"||r==="GeosetAnimId"&&s==="None")&&(s=null),i[r]=s}ie(t,","),Ji(t),Rt(t)}return E(t,"}"),n.Nodes[i.ObjectId]=i,i}function ja(t,e){let n=Qi(t,"Bone",e);e.Bones.push(n)}function Za(t,e){let n=Qi(t,"Helper",e);e.Helpers.push(n)}function Ja(t,e){let n=Qi(t,"Attachment",e);e.Attachments.push(n)}function Qa(t,e){let n=k(t),i=[];E(t,"{");for(let r=0;r<n;++r)i.push(ce(t,new Float32Array(3),0)),E(t,",");E(t,"}"),e.PivotPoints=i}function el(t,e){let n={Name:ge(t),ObjectId:null,Parent:null,PivotPoint:null,EventTrack:null,Flags:Zt.EventObject};for(E(t,"{");t.char()!=="}";){let i=z(t);if(i||J(t),i==="EventTrack"){let r=k(t);n.EventTrack=ce(t,new Uint32Array(r),0)}else i==="Translation"||i==="Rotation"||i==="Scaling"?n[i]=pe(t,i==="Rotation"?W.FLOAT4:W.FLOAT3):n[i]=k(t);ie(t,",")}E(t,"}"),e.EventObjects.push(n),e.Nodes[n.ObjectId]=n}function tl(t,e){let n={Name:ge(t),ObjectId:null,Parent:null,PivotPoint:null,Shape:gt.Box,Vertices:null,Flags:Zt.CollisionShape};for(E(t,"{");t.char()!=="}";){let i=z(t);if(i||J(t),i==="Sphere")n.Shape=gt.Sphere;else if(i==="Box")n.Shape=gt.Box;else if(i==="Vertices"){let r=k(t),s=new Float32Array(r*3);E(t,"{");for(let o=0;o<r;++o)ce(t,s,o*3),E(t,",");E(t,"}"),n.Vertices=s}else i==="Translation"||i==="Rotation"||i==="Scaling"?n[i]=pe(t,i==="Rotation"?W.FLOAT4:W.FLOAT3):n[i]=k(t);ie(t,",")}E(t,"}"),e.CollisionShapes.push(n),e.Nodes[n.ObjectId]=n}function nl(t,e){let n=[],i=k(t);E(t,"{");for(let r=0;r<i;++r)z(t)==="Duration"&&n.push(k(t)),ie(t,",");E(t,"}"),e.GlobalSequences=n}function il(t){let e;for(;t.char()!==void 0&&t.char()!=="{";)++t.pos;for(e=1,++t.pos;t.char()!==void 0&&e>0;)t.char()==="{"?++e:t.char()==="}"&&--e,++t.pos;Rt(t)}function rl(t,e){let n={ObjectId:null,Parent:null,Name:null,Flags:0};for(n.Name=ge(t),E(t,"{");t.char()!=="}";){let i=z(t),r=!1;if(i||J(t),i==="static"&&(r=!0,i=z(t)),i==="ObjectId"||i==="Parent")n[i]=k(t);else if(i==="EmitterUsesMDL"||i==="EmitterUsesTGA")n.Flags|=ji[i];else if(!r&&(i==="Visibility"||i==="Translation"||i==="Rotation"||i==="Scaling"||i==="EmissionRate"||i==="Gravity"||i==="Longitude"||i==="Latitude")){let s=W.FLOAT3;i==="Visibility"||i==="EmissionRate"||i==="Gravity"||i==="Longitude"||i==="Latitude"?s=W.FLOAT1:i==="Rotation"&&(s=W.FLOAT4),n[i]=pe(t,s)}else if(i==="Particle"){for(E(t,"{");t.char()!=="}";){let s=z(t),o=!1;s==="static"&&(o=!0,s=z(t)),!o&&(s==="LifeSpan"||s==="InitVelocity")?n[s]=pe(t,W.FLOAT1):s==="LifeSpan"||s==="InitVelocity"?n[s]=k(t):s==="Path"&&(n.Path=ge(t)),ie(t,",")}E(t,"}")}else n[i]=k(t);ie(t,",")}E(t,"}"),e.ParticleEmitters.push(n)}function sl(t,e){let n={Name:ge(t),ObjectId:null,Parent:null,PivotPoint:null,Flags:Zt.ParticleEmitter,FrameFlags:0};for(E(t,"{");t.char()!=="}";){let i=z(t),r=!1;if(i||J(t),i==="static"&&(r=!0,i=z(t)),!r&&(i==="Speed"||i==="Latitude"||i==="Visibility"||i==="EmissionRate"||i==="Width"||i==="Length"||i==="Translation"||i==="Rotation"||i==="Scaling"||i==="Gravity"||i==="Variation")){let s=W.FLOAT3;switch(i){case"Rotation":s=W.FLOAT4;break;case"Speed":case"Latitude":case"Visibility":case"EmissionRate":case"Width":case"Length":case"Gravity":case"Variation":s=W.FLOAT1;break}n[i]=pe(t,s)}else if(i==="Variation"||i==="Gravity"||i==="ReplaceableId"||i==="PriorityPlane")n[i]=k(t);else if(i==="SortPrimsFarZ"||i==="Unshaded"||i==="LineEmitter"||i==="Unfogged"||i==="ModelSpace"||i==="XYQuad")n.Flags|=$t[i];else if(i==="Both")n.FrameFlags|=Ve.Head|Ve.Tail;else if(i==="Head"||i==="Tail")n.FrameFlags|=Ve[i];else if(i==="Squirt")n[i]=!0;else if(i==="DontInherit"){E(t,"{");let s=z(t);s==="Translation"?n.Flags|=Pe.DontInheritTranslation:s==="Rotation"?n.Flags|=Pe.DontInheritRotation:s==="Scaling"&&(n.Flags|=Pe.DontInheritScaling),E(t,"}")}else if(i==="SegmentColor"){let s=[];for(E(t,"{");t.char()!=="}";){z(t);let o=new Float32Array(3);ce(t,o,0);let a=o[0];o[0]=o[2],o[2]=a,s.push(o),ie(t,",")}E(t,"}"),n.SegmentColor=s}else i==="Alpha"?(n.Alpha=new Uint8Array(3),ce(t,n.Alpha,0)):i==="ParticleScaling"?(n[i]=new Float32Array(3),ce(t,n[i],0)):i==="LifeSpanUVAnim"||i==="DecayUVAnim"||i==="TailUVAnim"||i==="TailDecayUVAnim"?(n[i]=new Uint32Array(3),ce(t,n[i],0)):i==="Transparent"||i==="Blend"||i==="Additive"||i==="AlphaKey"||i==="Modulate"||i==="Modulate2x"?n.FilterMode=on[i]:n[i]=k(t);ie(t,",")}E(t,"}"),e.ParticleEmitters2.push(n),e.Nodes[n.ObjectId]=n}function ol(t,e){let n={Name:null,Position:null,FieldOfView:0,NearClip:0,FarClip:0,TargetPosition:null};for(n.Name=ge(t),E(t,"{");t.char()!=="}";){let i=z(t);if(i||J(t),i==="Position")n.Position=new Float32Array(3),ce(t,n.Position,0);else if(i==="FieldOfView"||i==="NearClip"||i==="FarClip")n[i]=k(t);else if(i==="Target"){for(E(t,"{");t.char()!=="}";){let r=z(t);r==="Position"?(n.TargetPosition=new Float32Array(3),ce(t,n.TargetPosition,0)):r==="Translation"&&(n.TargetTranslation=pe(t,W.FLOAT3)),ie(t,",")}E(t,"}")}else(i==="Translation"||i==="Rotation")&&(n[i]=pe(t,i==="Rotation"?W.FLOAT1:W.FLOAT3));ie(t,",")}E(t,"}"),e.Cameras.push(n)}function al(t,e){let n={Name:ge(t),ObjectId:null,Parent:null,PivotPoint:null,Flags:Zt.Light,LightType:0};for(E(t,"{");t.char()!=="}";){let i=z(t),r=!1;if(i||J(t),i==="static"&&(r=!0,i=z(t)),!r&&(i==="Visibility"||i==="Color"||i==="Intensity"||i==="AmbIntensity"||i==="AmbColor"||i==="Translation"||i==="Rotation"||i==="Scaling"||i==="AttenuationStart"||i==="AttenuationEnd")){let s=W.FLOAT3;switch(i){case"Rotation":s=W.FLOAT4;break;case"Visibility":case"Intensity":case"AmbIntensity":case"AttenuationStart":case"AttenuationEnd":s=W.FLOAT1;break}if(n[i]=pe(t,s),i==="Color"||i==="AmbColor")for(let o of n[i].Keys)o.Vector.reverse(),o.InTan&&(o.InTan.reverse(),o.OutTan.reverse())}else if(i==="Omnidirectional"||i==="Directional"||i==="Ambient")n.LightType=Qn[i];else if(i==="Color"||i==="AmbColor"){let s=new Float32Array(3);ce(t,s,0);let o=s[0];s[0]=s[2],s[2]=o,n[i]=s}else n[i]=k(t);ie(t,",")}E(t,"}"),e.Lights.push(n),e.Nodes[n.ObjectId]=n}function ll(t,e){let n=[];for(k(t),E(t,"{");t.char()!=="}";){let i={};for(z(t),E(t,"{");t.char()!=="}";){let r=z(t);if(r||J(t),r==="Translation"||r==="Rotation"||r==="Scaling")i[r]=pe(t,r==="Rotation"?W.FLOAT4:W.FLOAT3);else throw new Error("Unknown texture anim property "+r);ie(t,",")}E(t,"}"),n.push(i)}E(t,"}"),e.TextureAnims=n}function cl(t,e){let n={Name:ge(t),ObjectId:null,Parent:null,PivotPoint:null,Flags:Zt.RibbonEmitter,HeightAbove:null,HeightBelow:null,Alpha:null,Color:null,LifeSpan:null,TextureSlot:null,EmissionRate:null,Rows:null,Columns:null,MaterialID:0,Gravity:null,Visibility:null};for(E(t,"{");t.char()!=="}";){let i=z(t),r=!1;if(i||J(t),i==="static"&&(r=!0,i=z(t)),!r&&(i==="Visibility"||i==="HeightAbove"||i==="HeightBelow"||i==="Translation"||i==="Rotation"||i==="Scaling"||i==="Alpha"||i==="TextureSlot")){let s=W.FLOAT3;switch(i){case"Rotation":s=W.FLOAT4;break;case"Visibility":case"HeightAbove":case"HeightBelow":case"Alpha":s=W.FLOAT1;break;case"TextureSlot":s=W.INT1;break}n[i]=pe(t,s)}else if(i==="Color"){let s=new Float32Array(3);ce(t,s,0);let o=s[0];s[0]=s[2],s[2]=o,n[i]=s}else n[i]=k(t);ie(t,",")}E(t,"}"),e.RibbonEmitters.push(n),e.Nodes[n.ObjectId]=n}function hl(t,e){e.Version<900&&J(t,"Unexpected model chunk FaceFX");let n={Name:ge(t),Path:""};for(E(t,"{");t.char()!=="}";){let i=z(t);i||J(t),i==="Path"&&(n.Path=ge(t)),ie(t,",")}E(t,"}"),e.FaceFX=e.FaceFX||[],e.FaceFX.push(n)}function ul(t,e){e.Version<900&&J(t,"Unexpected model chunk BindPose");let n={Matrices:[]};E(t,"{"),z(t);let i=k(t);E(t,"{");for(let r=0;r<i;++r){let s=new Float32Array(12);ce(t,s,0),ie(t,","),n.Matrices.push(s)}E(t,"}"),E(t,"}"),e.BindPoses=e.BindPoses||[],e.BindPoses.push(n)}function fl(t,e){e.Version<900&&J(t,"Unexpected model chunk ParticleEmitterPopcorn");let n={Name:ge(t),ObjectId:null,Parent:null,PivotPoint:null,Flags:Zt.ParticleEmitter};for(E(t,"{");t.char()!=="}";){let i=z(t),r=!1;if(i||J(t),i==="static"&&(r=!0,i=z(t)),!r&&(i==="LifeSpan"||i==="EmissionRate"||i==="Speed"||i==="Color"||i==="Alpha"||i==="Visibility"||i==="Rotation"||i==="Scaling"||i==="Translation")){let s=W.FLOAT3;switch(i){case"LifeSpan":case"EmissionRate":case"Speed":case"Alpha":case"Visibility":s=W.FLOAT1;break}n[i]=pe(t,s)}else i==="LifeSpan"||i==="EmissionRate"||i==="Speed"||i==="Alpha"?n[i]=k(t):i==="Color"?n[i]=ce(t,new Float32Array(3),0):i==="ReplaceableId"?n[i]=k(t):i==="Path"||i==="AnimVisibilityGuide"?n[i]=ge(t):i==="Unshaded"||i==="SortPrimsFarZ"||i==="Unfogged"?i==="Unshaded"?n.Flags|=an.Unshaded:i==="Unfogged"?n.Flags|=an.Unfogged:i==="SortPrimsFarZ"&&(n.Flags|=an.SortPrimsFarZ):n[i]=k(t);ie(t,",")}E(t,"}"),e.ParticleEmitterPopcorns=e.ParticleEmitterPopcorns||[],e.ParticleEmitterPopcorns.push(n),e.Nodes[n.ObjectId]=n}var ls={Version:Ga,Model:ka,Sequences:za,Textures:Ha,Materials:$a,Geoset:Ya,GeosetAnim:Ka,Bone:ja,Helper:Za,Attachment:Ja,PivotPoints:Qa,EventObject:el,CollisionShape:tl,GlobalSequences:nl,ParticleEmitter:rl,ParticleEmitter2:sl,Camera:ol,Light:al,TextureAnims:ll,RibbonEmitter:cl,FaceFX:hl,BindPose:ul,ParticleEmitterPopcorn:fl};function ii(t){let e=new Fa(t),n={Version:800,Info:{Name:"",MinimumExtent:null,MaximumExtent:null,BoundsRadius:0,BlendTime:150},Sequences:[],GlobalSequences:[],Textures:[],Materials:[],TextureAnims:[],Geosets:[],GeosetAnims:[],Bones:[],Helpers:[],Attachments:[],EventObjects:[],ParticleEmitters:[],ParticleEmitters2:[],Cameras:[],Lights:[],RibbonEmitters:[],CollisionShapes:[],PivotPoints:[],Nodes:[]};for(;e.pos<e.str.length;){for(;Ji(e););let i=z(e);if(i)i in ls?ls[i](e,n):il(e);else break}for(let i=0;i<n.Nodes.length;++i)n.PivotPoints[i]&&(n.Nodes[i].PivotPoint=n.PivotPoints[i]);return n}var $i=!0,Pt=-1,L=(function(t){return t[t.INT1=0]="INT1",t[t.FLOAT1=1]="FLOAT1",t[t.FLOAT3=2]="FLOAT3",t[t.FLOAT4=3]="FLOAT4",t})(L||{}),dl={[L.INT1]:1,[L.FLOAT1]:1,[L.FLOAT3]:3,[L.FLOAT4]:4},pl=class{constructor(t){this.ab=t,this.pos=0,this.length=t.byteLength,this.view=new DataView(this.ab),this.uint=new Uint8Array(this.ab)}keyword(){let t=String.fromCharCode(this.uint[this.pos],this.uint[this.pos+1],this.uint[this.pos+2],this.uint[this.pos+3]);return this.pos+=4,t}expectKeyword(t,e){if(this.keyword()!==t)throw new Error(e)}uint8(){return this.view.getUint8(this.pos++)}uint16(){let t=this.view.getUint16(this.pos,$i);return this.pos+=2,t}int32(){let t=this.view.getInt32(this.pos,$i);return this.pos+=4,t}float32(){let t=this.view.getFloat32(this.pos,$i);return this.pos+=4,t}float32Array(t){let e=new Float32Array(t);for(let n=0;n<t;++n)e[n]=this.float32();return e}uint8Array(t){let e=new Uint8Array(t);for(let n=0;n<t;++n)e[n]=this.uint8();return e}str(t){let e=t;for(;this.uint[this.pos+e-1]===0&&e>0;)--e;let n=String.fromCharCode.apply(String,this.uint.slice(this.pos,this.pos+e));return this.pos+=t,n}animVector(t){let e={Keys:[]},n=t===L.INT1,i=dl[t],r=this.int32();e.LineType=this.int32(),e.GlobalSeqId=this.int32(),e.GlobalSeqId===Pt&&(e.GlobalSeqId=null);for(let s=0;s<r;++s){let o={};o.Frame=this.int32(),n?o.Vector=new Int32Array(i):o.Vector=new Float32Array(i);for(let a=0;a<i;++a)n?o.Vector[a]=this.int32():o.Vector[a]=this.float32();if(e.LineType===Ne.Hermite||e.LineType===Ne.Bezier)for(let a of["InTan","OutTan"]){o[a]=new Float32Array(i);for(let c=0;c<i;++c)n?o[a][c]=this.int32():o[a][c]=this.float32()}e.Keys.push(o)}return e}};function ti(t,e){t.BoundsRadius=e.float32();for(let n of["MinimumExtent","MaximumExtent"]){t[n]=new Float32Array(3);for(let i=0;i<3;++i)t[n][i]=e.float32()}}function ml(t,e){t.Version=e.int32()}var gl=336;function vl(t,e){t.Info.Name=e.str(gl),e.int32(),ti(t.Info,e),t.Info.BlendTime=e.int32()}var xl=80;function yl(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.str(xl),s={};s.Name=r;let o=new Uint32Array(2);o[0]=e.int32(),o[1]=e.int32(),s.Interval=o,s.MoveSpeed=e.float32(),s.NonLooping=e.int32()>0,s.Rarity=e.float32(),e.int32(),ti(s,e),t.Sequences.push(s)}}function _l(t,e,n){let i=e.pos;for(;e.pos<i+n;){e.int32();let r={Layers:[]};r.PriorityPlane=e.int32(),r.RenderMode=e.int32(),t.Version>=900&&t.Version<1100&&(r.Shader=e.str(80)),e.expectKeyword("LAYS","Incorrect materials format");let s=e.int32();for(let o=0;o<s;++o){let a=e.pos,c=e.int32(),h={};if(h.FilterMode=e.int32(),h.Shading=e.int32(),h.TextureID=e.int32(),h.TVertexAnimId=e.int32(),h.TVertexAnimId===Pt&&(h.TVertexAnimId=null),h.CoordId=e.int32(),h.Alpha=e.float32(),t.Version>=900&&(h.EmissiveGain=e.float32(),t.Version>=1e3&&(h.FresnelColor=e.float32Array(3),h.FresnelOpacity=e.float32(),h.FresnelTeamColor=e.float32())),t.Version>=1100){h.ShaderTypeId=e.int32();let l=e.int32();for(let d=0;d<l;++d){let u=e.int32();e.int32();let f=d;e.keyword()==="KMTF"?h[Yt[f]]=e.animVector(L.INT1):(h[Yt[f]]=u,e.pos-=4)}}for(;e.pos<a+c;){let l=e.keyword();if(l==="KMTA")h.Alpha=e.animVector(L.FLOAT1);else if(l==="KMTF")h.TextureID=e.animVector(L.INT1);else if(l==="KMTE"&&t.Version>=900)h.EmissiveGain=e.animVector(L.FLOAT1);else if(l==="KFC3"&&t.Version>=1e3)h.FresnelColor=e.animVector(L.FLOAT3);else if(l==="KFCA"&&t.Version>=1e3)h.FresnelOpacity=e.animVector(L.FLOAT1);else if(l==="KFTC"&&t.Version>=1e3)h.FresnelTeamColor=e.animVector(L.FLOAT1);else throw new Error("Unknown layer chunk data "+l)}r.Layers.push(h)}t.Materials.push(r)}}var bl=256;function Sl(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r={};r.ReplaceableId=e.int32(),r.Image=e.str(bl),e.int32(),r.Flags=e.int32(),t.Textures.push(r)}}function Ml(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r={};e.int32(),e.expectKeyword("VRTX","Incorrect geosets format");let s=e.int32();r.Vertices=new Float32Array(s*3);for(let g=0;g<s*3;++g)r.Vertices[g]=e.float32();e.expectKeyword("NRMS","Incorrect geosets format");let o=e.int32();r.Normals=new Float32Array(o*3);for(let g=0;g<o*3;++g)r.Normals[g]=e.float32();e.expectKeyword("PTYP","Incorrect geosets format");let a=e.int32();for(let g=0;g<a;++g)if(e.int32()!==4)throw new Error("Incorrect geosets format");e.expectKeyword("PCNT","Incorrect geosets format");let c=e.int32();for(let g=0;g<c;++g)e.int32();e.expectKeyword("PVTX","Incorrect geosets format");let h=e.int32();r.Faces=new Uint16Array(h);for(let g=0;g<h;++g)r.Faces[g]=e.uint16();e.expectKeyword("GNDX","Incorrect geosets format");let l=e.int32();r.VertexGroup=new Uint8Array(l);for(let g=0;g<l;++g)r.VertexGroup[g]=e.uint8();e.expectKeyword("MTGC","Incorrect geosets format");let d=e.int32();r.Groups=[];for(let g=0;g<d;++g)r.Groups[g]=new Array(e.int32());e.expectKeyword("MATS","Incorrect geosets format"),r.TotalGroupsCount=e.int32();let u=0,f=0;for(let g=0;g<r.TotalGroupsCount;++g)u>=r.Groups[f].length&&(u=0,f++),r.Groups[f][u++]=e.int32();r.MaterialID=e.int32(),r.SelectionGroup=e.int32(),r.Unselectable=e.int32()>0,t.Version>=900&&(r.LevelOfDetail=e.int32(),r.Name=e.str(80)),ti(r,e);let p=e.int32();r.Anims=[];for(let g=0;g<p;++g){let y={};ti(y,e),r.Anims.push(y)}let m=e.keyword();if(t.Version>=900)for(;;){if(e.pos>=e.length)throw new Error("Unexpected EOF");if(m==="TANG"){if(r.Tangents)throw new Error("Incorrect geoset, multiple Tangents");let g=e.int32();r.Tangents=e.float32Array(g*4)}else if(m==="SKIN"){if(r.SkinWeights)throw new Error("Incorrect geoset, multiple SkinWeights");let g=e.int32();r.SkinWeights=e.uint8Array(g)}else if(m==="UVAS")break;m=e.keyword()}else if(m!=="UVAS")throw new Error("Incorrect geosets format");let x=e.int32();r.TVertices=[];for(let g=0;g<x;++g){e.expectKeyword("UVBS","Incorrect geosets format");let y=e.int32(),v=new Float32Array(y*2);for(let b=0;b<y*2;++b)v[b]=e.float32();r.TVertices.push(v)}t.Geosets.push(r)}}function Tl(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};o.Alpha=e.float32(),o.Flags=e.int32(),o.Color=new Float32Array(3);for(let a=0;a<3;++a)o.Color[a]=e.float32();for(o.GeosetId=e.int32(),o.GeosetId===Pt&&(o.GeosetId=null);e.pos<r+s;){let a=e.keyword();if(a==="KGAO")o.Alpha=e.animVector(L.FLOAT1);else if(a==="KGAC")o.Color=e.animVector(L.FLOAT3);else throw new Error("Incorrect GeosetAnim chunk data "+a)}t.GeosetAnims.push(o)}}var Al=80;function lt(t,e,n){let i=n.pos,r=n.int32();for(e.Name=n.str(Al),e.ObjectId=n.int32(),e.ObjectId===Pt&&(e.ObjectId=null),e.Parent=n.int32(),e.Parent===Pt&&(e.Parent=null),e.Flags=n.int32();n.pos<i+r;){let s=n.keyword();if(s==="KGTR")e.Translation=n.animVector(L.FLOAT3);else if(s==="KGRT")e.Rotation=n.animVector(L.FLOAT4);else if(s==="KGSC")e.Scaling=n.animVector(L.FLOAT3);else throw new Error("Incorrect node chunk data "+s)}t.Nodes[e.ObjectId]=e}function El(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r={};lt(t,r,e),r.GeosetId=e.int32(),r.GeosetId===Pt&&(r.GeosetId=null),r.GeosetAnimId=e.int32(),r.GeosetAnimId===Pt&&(r.GeosetAnimId=null),t.Bones.push(r)}}function wl(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r={};lt(t,r,e),t.Helpers.push(r)}}var Pl=256;function Cl(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};lt(t,o,e),o.Path=e.str(Pl),e.int32(),o.AttachmentID=e.int32(),e.pos<r+s&&(e.expectKeyword("KATV","Incorrect attachment chunk data"),o.Visibility=e.animVector(L.FLOAT1)),t.Attachments.push(o)}}function Rl(t,e,n){let i=n/12;for(let r=0;r<i;++r)t.PivotPoints[r]=new Float32Array(3),t.PivotPoints[r][0]=e.float32(),t.PivotPoints[r][1]=e.float32(),t.PivotPoints[r][2]=e.float32()}function Il(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r={};lt(t,r,e),e.expectKeyword("KEVT","Incorrect EventObject chunk data");let s=e.int32();r.EventTrack=new Uint32Array(s),e.int32();for(let o=0;o<s;++o)r.EventTrack[o]=e.int32();t.EventObjects.push(r)}}function Ll(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r={};lt(t,r,e),r.Shape=e.int32(),r.Shape===gt.Box?r.Vertices=new Float32Array(6):r.Vertices=new Float32Array(3);for(let s=0;s<r.Vertices.length;++s)r.Vertices[s]=e.float32();r.Shape===gt.Sphere&&(r.BoundsRadius=e.float32()),t.CollisionShapes.push(r)}}function Fl(t,e,n){let i=e.pos;for(t.GlobalSequences=[];e.pos<i+n;)t.GlobalSequences.push(e.int32())}var Dl=256;function Ul(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};for(lt(t,o,e),o.EmissionRate=e.float32(),o.Gravity=e.float32(),o.Longitude=e.float32(),o.Latitude=e.float32(),o.Path=e.str(Dl),e.int32(),o.LifeSpan=e.float32(),o.InitVelocity=e.float32();e.pos<r+s;){let a=e.keyword();if(a==="KPEV")o.Visibility=e.animVector(L.FLOAT1);else if(a==="KPEE")o.EmissionRate=e.animVector(L.FLOAT1);else if(a==="KPEG")o.Gravity=e.animVector(L.FLOAT1);else if(a==="KPLN")o.Longitude=e.animVector(L.FLOAT1);else if(a==="KPLT")o.Latitude=e.animVector(L.FLOAT1);else if(a==="KPEL")o.LifeSpan=e.animVector(L.FLOAT1);else if(a==="KPES")o.InitVelocity=e.animVector(L.FLOAT1);else throw new Error("Incorrect particle emitter chunk data "+a)}t.ParticleEmitters.push(o)}}function Nl(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};lt(t,o,e),o.Speed=e.float32(),o.Variation=e.float32(),o.Latitude=e.float32(),o.Gravity=e.float32(),o.LifeSpan=e.float32(),o.EmissionRate=e.float32(),o.Width=e.float32(),o.Length=e.float32(),o.FilterMode=e.int32(),o.Rows=e.int32(),o.Columns=e.int32();let a=e.int32();o.FrameFlags=0,(a===0||a===2)&&(o.FrameFlags|=Ve.Head),(a===1||a===2)&&(o.FrameFlags|=Ve.Tail),o.TailLength=e.float32(),o.Time=e.float32(),o.SegmentColor=[];for(let c=0;c<3;++c){o.SegmentColor[c]=new Float32Array(3);for(let h=0;h<3;++h)o.SegmentColor[c][h]=e.float32()}o.Alpha=new Uint8Array(3);for(let c=0;c<3;++c)o.Alpha[c]=e.uint8();o.ParticleScaling=new Float32Array(3);for(let c=0;c<3;++c)o.ParticleScaling[c]=e.float32();for(let c of["LifeSpanUVAnim","DecayUVAnim","TailUVAnim","TailDecayUVAnim"]){o[c]=new Uint32Array(3);for(let h=0;h<3;++h)o[c][h]=e.int32()}for(o.TextureID=e.int32(),o.TextureID===Pt&&(o.TextureID=null),o.Squirt=e.int32()>0,o.PriorityPlane=e.int32(),o.ReplaceableId=e.int32();e.pos<r+s;){let c=e.keyword();if(c==="KP2V")o.Visibility=e.animVector(L.FLOAT1);else if(c==="KP2E")o.EmissionRate=e.animVector(L.FLOAT1);else if(c==="KP2W")o.Width=e.animVector(L.FLOAT1);else if(c==="KP2N")o.Length=e.animVector(L.FLOAT1);else if(c==="KP2S")o.Speed=e.animVector(L.FLOAT1);else if(c==="KP2L")o.Latitude=e.animVector(L.FLOAT1);else if(c==="KP2G")o.Gravity=e.animVector(L.FLOAT1);else if(c==="KP2R")o.Variation=e.animVector(L.FLOAT1);else throw new Error("Incorrect particle emitter2 chunk data "+c)}t.ParticleEmitters2.push(o)}}var Bl=80;function Ol(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};for(o.Name=e.str(Bl),o.Position=new Float32Array(3),o.Position[0]=e.float32(),o.Position[1]=e.float32(),o.Position[2]=e.float32(),o.FieldOfView=e.float32(),o.FarClip=e.float32(),o.NearClip=e.float32(),o.TargetPosition=new Float32Array(3),o.TargetPosition[0]=e.float32(),o.TargetPosition[1]=e.float32(),o.TargetPosition[2]=e.float32();e.pos<r+s;){let a=e.keyword();if(a==="KCTR")o.Translation=e.animVector(L.FLOAT3);else if(a==="KTTR")o.TargetTranslation=e.animVector(L.FLOAT3);else if(a==="KCRL")o.Rotation=e.animVector(L.FLOAT1);else throw new Error("Incorrect camera chunk data "+a)}t.Cameras.push(o)}}function Vl(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};lt(t,o,e),o.LightType=e.int32(),o.AttenuationStart=e.float32(),o.AttenuationEnd=e.float32(),o.Color=new Float32Array(3);for(let a=0;a<3;++a)o.Color[a]=e.float32();o.Intensity=e.float32(),o.AmbColor=new Float32Array(3);for(let a=0;a<3;++a)o.AmbColor[a]=e.float32();for(o.AmbIntensity=e.float32();e.pos<r+s;){let a=e.keyword();if(a==="KLAV")o.Visibility=e.animVector(L.FLOAT1);else if(a==="KLAC")o.Color=e.animVector(L.FLOAT3);else if(a==="KLAI")o.Intensity=e.animVector(L.FLOAT1);else if(a==="KLBC")o.AmbColor=e.animVector(L.FLOAT3);else if(a==="KLBI")o.AmbIntensity=e.animVector(L.FLOAT1);else if(a==="KLAS")o.AttenuationStart=e.animVector(L.INT1);else if(a==="KLAE")o.AttenuationEnd=e.animVector(L.INT1);else throw new Error("Incorrect light chunk data "+a)}t.Lights.push(o)}}function Gl(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};for(;e.pos<r+s;){let a=e.keyword();if(a==="KTAT")o.Translation=e.animVector(L.FLOAT3);else if(a==="KTAR")o.Rotation=e.animVector(L.FLOAT4);else if(a==="KTAS")o.Scaling=e.animVector(L.FLOAT3);else throw new Error("Incorrect light chunk data "+a)}t.TextureAnims.push(o)}}function kl(t,e,n){let i=e.pos;for(;e.pos<i+n;){let r=e.pos,s=e.int32(),o={};lt(t,o,e),o.HeightAbove=e.float32(),o.HeightBelow=e.float32(),o.Alpha=e.float32(),o.Color=new Float32Array(3);for(let a=0;a<3;++a)o.Color[a]=e.float32();for(o.LifeSpan=e.float32(),o.TextureSlot=e.int32(),o.EmissionRate=e.int32(),o.Rows=e.int32(),o.Columns=e.int32(),o.MaterialID=e.int32(),o.Gravity=e.float32();e.pos<r+s;){let a=e.keyword();if(a==="KRVS")o.Visibility=e.animVector(L.FLOAT1);else if(a==="KRHA")o.HeightAbove=e.animVector(L.FLOAT1);else if(a==="KRHB")o.HeightBelow=e.animVector(L.FLOAT1);else if(a==="KRAL")o.Alpha=e.animVector(L.FLOAT1);else if(a==="KRTX")o.TextureSlot=e.animVector(L.INT1);else throw new Error("Incorrect ribbon emitter chunk data "+a)}t.RibbonEmitters.push(o)}}function zl(t,e,n){if(t.Version<900)throw new Error("Mismatched version chunk");let i=e.pos;for(t.FaceFX=t.FaceFX||[];e.pos<i+n;){let r={Name:"",Path:""};r.Name=e.str(80),r.Path=e.str(260),t.FaceFX.push(r)}}function Hl(t,e,n){if(t.Version<900)throw new Error("Mismatched version chunk");let i=e.pos;t.BindPoses=t.BindPoses||[];let r=e.int32(),s={Matrices:[]};for(let o=0;o<r;++o){let a=e.float32Array(12);s.Matrices.push(a)}if(t.BindPoses.push(s),e.pos!==i+n)throw new Error("Mismatched BindPose data")}function Wl(t,e,n){if(t.Version<900)throw new Error("Mismatched version chunk");let i=e.pos;for(t.ParticleEmitterPopcorns=t.ParticleEmitterPopcorns||[];e.pos<i+n;){let r=e.pos,s=e.int32(),o={};for(lt(t,o,e),o.LifeSpan=e.float32(),o.EmissionRate=e.float32(),o.Speed=e.float32(),o.Color=e.float32Array(3),o.Alpha=e.float32(),o.ReplaceableId=e.int32(),o.Path=e.str(260),o.AnimVisibilityGuide=e.str(260);e.pos<r+s;){let a=e.keyword();if(a==="KPPA")o.Alpha=e.animVector(L.FLOAT1);else if(a==="KPPC")o.Color=e.animVector(L.FLOAT3);else if(a==="KPPE")o.EmissionRate=e.animVector(L.FLOAT1);else if(a==="KPPL")o.LifeSpan=e.animVector(L.FLOAT1);else if(a==="KPPS")o.Speed=e.animVector(L.FLOAT1);else if(a==="KPPV")o.Visibility=e.animVector(L.FLOAT1);else throw new Error("Incorrect particle emitter popcorn chunk data "+a)}t.ParticleEmitterPopcorns.push(o)}}var cs={VERS:ml,MODL:vl,SEQS:yl,MTLS:_l,TEXS:Sl,GEOS:Ml,GEOA:Tl,BONE:El,HELP:wl,ATCH:Cl,PIVT:Rl,EVTS:Il,CLID:Ll,GLBS:Fl,PREM:Ul,PRE2:Nl,CAMS:Ol,LITE:Vl,TXAN:Gl,RIBB:kl,FAFX:zl,BPOS:Hl,CORN:Wl};function us(t){let e=new pl(t);if(e.keyword()!=="MDLX")throw new Error("Not a mdx model");let n={Version:800,Info:{Name:"",MinimumExtent:null,MaximumExtent:null,BoundsRadius:0,BlendTime:150},Sequences:[],GlobalSequences:[],Textures:[],Materials:[],TextureAnims:[],Geosets:[],GeosetAnims:[],Bones:[],Helpers:[],Attachments:[],EventObjects:[],ParticleEmitters:[],ParticleEmitters2:[],Cameras:[],Lights:[],RibbonEmitters:[],CollisionShapes:[],PivotPoints:[],Nodes:[]};for(;e.pos<e.length;){let i=e.keyword(),r=e.int32();i in cs?cs[i](n,e,r):e.pos+=r}for(let i=0;i<n.Nodes.length;++i)n.Nodes[i]&&n.PivotPoints[i]&&(n.Nodes[i].PivotPoint=n.PivotPoints[i]);return n.Info.NumGeosets=n.Geosets.length,n.Info.NumGeosetAnims=n.GeosetAnims.length,n.Info.NumBones=n.Bones.length,n.Info.NumLights=n.Lights.length,n.Info.NumAttachments=n.Attachments.length,n.Info.NumEvents=n.EventObjects.length,n.Info.NumParticleEmitters=n.ParticleEmitters.length,n.Info.NumParticleEmitters2=n.ParticleEmitters2.length,n.Info.NumRibbonEmitters=n.RibbonEmitters.length,n}var Xl=6,Ln=1e-6;function ql(t,e=0){return Math.abs(t[0]-e)>Ln||Math.abs(t[1]-e)>Ln||Math.abs(t[2]-e)>Ln}function fe(t=1){if(t===0)return"";let e="	";for(let n=1;n<t;++n)e+="	";return e}function fs(t){return`"${t}"`}function $l(t){return typeof t=="number"?String(t):fs(t)}function H(t,e=null,n=0){return fe(n)+t+" "+(e!==null?$l(e)+" ":"")+`{
`}function X(t=0){return fe(t)+`}
`}var Yl=/(\..+?)0+$/,Kl=/\.0+$/,jl=/^-0$/;function Kt(t){return t.toFixed(Xl).replace(Yl,"$1").replace(Kl,"").replace(jl,"0")}function at(t,e=!1){let n="";if(e)for(let i=t.length-1;i>=0;--i)i<t.length-1&&(n+=", "),n+=Kt(t[i]);else for(let i=0;i<t.length;++i)i>0&&(n+=", "),n+=Kt(t[i]);return"{ "+n+" }"}function er(t){let e="";for(let n=0;n<t.length;++n)n>0&&(e+=", "),e+=String(t[n]);return"{ "+e+" }"}function Zl(t){return t?"static ":""}function hn(t,e,n,i=1){return`${fe(i)+Zl(n)+t} ${e},
`}function ue(t,e,n=null,i=1){return hn(t,String(e),n,i)}function ln(t,e,n=null,i=1){return hn(t,Kt(e),n,i)}function Zi(t,e,n=null,i=1){return hn(t,e,n,i)}function Ct(t,e,n=null,i=1){return hn(t,fs(e),n,i)}function Ce(t,e,n=null,i=1){return hn(t,at(e),n,i)}function ds(t,e,n=null,i=1){return hn(t,er(e),n,i)}function K(t,e=1){return fe(e)+t+`,
`}function ne(t,e,n=0,i=null,r=1){return e!==n&&e!==null&&e!==void 0?ue(t,e,i,r):""}function cn(t,e,n=0,i=null,r=1){return Math.abs(e-n)>Ln?ln(t,e,i,r):""}function Jl(t){switch(t){case Ne.DontInterp:return"DontInterp";case Ne.Linear:return"Linear";case Ne.Bezier:return"Bezier";case Ne.Hermite:return"Hermite"}return""}function Ql(t,e=2,n=!1){let i=fe(e)+t.Frame+": "+(t.Vector.length===1?Kt(t.Vector[0]):at(t.Vector,n))+`,
`;return t.InTan&&(i+=fe(e+1)+"InTan "+(t.InTan.length===1?Kt(t.InTan[0]):at(t.InTan,n))+`,
`,i+=fe(e+1)+"OutTan "+(t.OutTan.length===1?Kt(t.OutTan[0]):at(t.OutTan,n))+`,
`),i}function V(t,e,n=0,i=1,r=!1){return e==null?"":typeof e=="number"?typeof n=="number"&&Math.abs(e-n)<Ln?"":ln(t,e,!0,i):H(t,e.Keys.length,i)+K(Jl(e.LineType),i+1)+(e.GlobalSeqId!==null?ue("GlobalSeqId",e.GlobalSeqId,null,i+1):"")+e.Keys.map(s=>Ql(s,i+1,r)).join("")+X(i)}function ec(t){return H("Version")+ue("FormatVersion",t.Version)+X()}function tc(t){return H("Model",t.Info.Name)+ne("NumGeosets",t.Geosets.length)+ne("NumGeosetAnims",t.GeosetAnims.length)+ne("NumHelpers",t.Helpers.length)+ne("NumBones",t.Bones.length)+(t.Lights.length?ne("NumLights",t.Lights.length):"")+ne("NumAttachments",t.Attachments.length)+ne("NumEvents",t.EventObjects.length)+ne("NumParticleEmitters",t.ParticleEmitters.length)+(t.ParticleEmitters2.length?ne("NumParticleEmitters2",t.ParticleEmitters2.length):"")+(t.RibbonEmitters.length?ne("NumRibbonEmitters",t.RibbonEmitters.length):"")+ue("BlendTime",t.Info.BlendTime)+Ce("MinimumExtent",t.Info.MinimumExtent)+Ce("MaximumExtent",t.Info.MaximumExtent)+cn("BoundsRadius",t.Info.BoundsRadius)+X()}function nc(t){return H("Sequences",t.Sequences.length)+t.Sequences.map(ic).join("")+X()}function ic(t){return H("Anim",t.Name,1)+ds("Interval",t.Interval,null,2)+cn("Rarity",t.Rarity,0,null,2)+cn("MoveSpeed",t.MoveSpeed,0,null,2)+(t.NonLooping?K("NonLooping",2):"")+Ce("MinimumExtent",t.MinimumExtent,null,2)+Ce("MaximumExtent",t.MaximumExtent,null,2)+cn("BoundsRadius",t.BoundsRadius,0,null,2)+X(1)}function rc(t){return!t.GlobalSequences||!t.GlobalSequences.length?"":H("GlobalSequences",t.GlobalSequences.length)+t.GlobalSequences.map(e=>ue("Duration",e)).join("")+X()}function sc(t){return t.Textures.length?H("Textures",t.Textures.length)+t.Textures.map(oc).join("")+X():""}function oc(t){return H("Bitmap",null,1)+Ct("Image",t.Image,null,2)+ne("ReplaceableId",t.ReplaceableId,0,null,2)+(t.Flags&ei.WrapWidth?K("WrapWidth",2):"")+(t.Flags&ei.WrapHeight?K("WrapHeight",2):"")+X(1)}function ac(t){return t.Materials.length?H("Materials",t.Materials.length)+t.Materials.map(e=>lc(t,e)).join("")+X():""}function lc(t,e){let n="";return t.Version>=900&&t.Version<1100&&e.Shader&&(n=Ct("Shader",e.Shader,!1,2)),H("Material",null,1)+(e.RenderMode&Jn.ConstantColor?K("ConstantColor",2):"")+(e.RenderMode&Jn.SortPrimsFarZ?K("SortPrimsFarZ",2):"")+(e.RenderMode&Jn.FullResolution?K("FullResolution",2):"")+ne("PriorityPlane",e.PriorityPlane,0,null,2)+ne("RenderMode",e.RenderMode,0,null,2)+n+e.Layers.map(i=>hc(t,i)).join("")+X(1)}function cc(t){switch(t){case wt.None:return"None";case wt.Transparent:return"Transparent";case wt.Blend:return"Blend";case wt.Additive:return"Additive";case wt.AddAlpha:return"AddAlpha";case wt.Modulate:return"Modulate";case wt.Modulate2x:return"Modulate2x"}return""}function hc(t,e){let n="";return t.Version>=900&&(n+=e.EmissiveGain!==void 0?V("EmissiveGain",e.EmissiveGain,1,3):"",t.Version>=1e3&&(n+=e.FresnelColor!==void 0?jt("FresnelColor",e.FresnelColor,!0,3):"",n+=e.FresnelOpacity!==void 0?V("FresnelOpacity",e.FresnelOpacity,0,3):"",n+=e.FresnelTeamColor!==void 0?V("FresnelTeamColor",e.FresnelTeamColor,0,3):"")),t.Version>=1100&&(n+=ue("ShaderTypeId",e.ShaderTypeId||0,null,3),Yt.slice(1).forEach(i=>{let r=e[i];r!==void 0&&(n+=V(i,r,null,3))})),H("Layer",null,2)+Zi("FilterMode",cc(e.FilterMode),null,3)+(e.Alpha!==void 0?V("Alpha",e.Alpha,1,3):"")+(e.TextureID!==void 0?V("TextureID",e.TextureID,null,3):"")+(e.Shading&qt.TwoSided?K("TwoSided",3):"")+(e.Shading&qt.Unshaded?K("Unshaded",3):"")+(e.Shading&qt.Unfogged?K("Unfogged",3):"")+(e.Shading&qt.SphereEnvMap?K("SphereEnvMap",3):"")+(e.Shading&qt.NoDepthTest?K("NoDepthTest",3):"")+(e.Shading&qt.NoDepthSet?K("NoDepthSet",3):"")+ne("CoordId",e.CoordId,0,null,3)+ne("TVertexAnimId",e.TVertexAnimId,null,null,3)+n+X(2)}function uc(t){return t.TextureAnims.length?H("TextureAnims",t.TextureAnims.length)+t.TextureAnims.map(fc).join("")+X():""}function fc(t){return H("TVertexAnim",null,1)+(t.Translation?V("Translation",t.Translation,null,2):"")+(t.Rotation?V("Rotation",t.Rotation,null,2):"")+(t.Scaling?V("Scaling",t.Scaling,null,2):"")+X(1)}function dc(t){return t.Geosets.length?t.Geosets.map(e=>pc(t,e)).join(""):""}function pc(t,e){let n="";return t.Version>=900&&(n+=(e.LevelOfDetail!==void 0?ue("LevelOfDetail",e.LevelOfDetail):"")+(e.Name?Ct("Name",e.Name):"")+(e.Tangents?Rn("Tangents",e.Tangents,4):"")+(e.SkinWeights?Rn("SkinWeights",e.SkinWeights,8):"")),H("Geoset")+Rn("Vertices",e.Vertices,3)+Rn("Normals",e.Normals,3)+Rn("TVertices",e.TVertices[0],2)+mc(e.VertexGroup)+gc(e.Faces)+vc(e.Groups)+Ce("MinimumExtent",e.MinimumExtent)+Ce("MaximumExtent",e.MaximumExtent)+cn("BoundsRadius",e.BoundsRadius)+xc(e.Anims)+ue("MaterialID",e.MaterialID)+ue("SelectionGroup",e.SelectionGroup)+(e.Unselectable?K("Unselectable"):"")+n+X()}function Rn(t,e,n){let i="",r=e.length/n;for(let s=0;s<r;++s)i+=fe(2)+at(e.slice(s*n,(s+1)*n))+`,
`;return H(t,r,1)+i+X(1)}function mc(t){if(!t.length)return"";let e="";for(let n=0;n<t.length;++n)e+=fe(2)+t[n]+`,
`;return H("VertexGroup",null,1)+e+X(1)}function gc(t){return H(`Faces 1 ${t.length}`,null,1)+H("Triangles",null,2)+fe(3)+er(t)+`,
`+X(2)+X(1)}function vc(t){let e=0,n="";for(let i of t)e+=i.length,n+=fe(2)+"Matrices "+er(i)+`,
`;return H(`Groups ${t.length} ${e}`,null,1)+n+X(1)}function xc(t){return t?t.map(yc).join(""):""}function yc(t){return H("Anim",null,1)+Ce("MinimumExtent",t.MinimumExtent,null,2)+Ce("MaximumExtent",t.MaximumExtent,null,2)+cn("BoundsRadius",t.BoundsRadius,0,null,2)+X(1)}function _c(t){return t.GeosetAnims.length?t.GeosetAnims.map(bc).join(""):""}function jt(t,e,n,i=1){if(e)if(e instanceof Float32Array){if(!n||ql(e,1)){let r="";for(let s=2;s>=0;--s)s<2&&(r+=", "),r+=Kt(e[s]);return`${fe(i)}${n?"static ":""}${t} { ${r} },
`}}else return V(t,e,null,i,!0);return""}function bc(t){return H("GeosetAnim")+ue("GeosetId",t.GeosetId)+V("Alpha",t.Alpha,1)+jt("Color",t.Color,!0)+(t.Flags&hs.DropShadow?K("DropShadow"):"")+X()}function ct(t){return ue("ObjectId",t.ObjectId)+ne("Parent",t.Parent,null)+Sc(t.Flags)+(t.Flags&Pe.Billboarded?K("Billboarded"):"")+(t.Flags&Pe.BillboardedLockX?K("BillboardedLockX"):"")+(t.Flags&Pe.BillboardedLockY?K("BillboardedLockY"):"")+(t.Flags&Pe.BillboardedLockZ?K("BillboardedLockZ"):"")+(t.Flags&Pe.CameraAnchored?K("CameraAnchored"):"")+(t.Translation!==void 0?V("Translation",t.Translation):"")+(t.Rotation!==void 0?V("Rotation",t.Rotation):"")+(t.Scaling!==void 0?V("Scaling",t.Scaling):"")}function Sc(t){let e=[];return t&Pe.DontInheritTranslation&&e.push("Translation"),t&Pe.DontInheritRotation&&e.push("Rotation"),t&Pe.DontInheritScaling&&e.push("Scaling"),e.length?fe(1)+"DontInherit { "+e.join(", ")+` },
`:""}function Mc(t){return t.Bones.length?t.Bones.map(Tc).join(""):""}function Tc(t){return H("Bone",t.Name)+ct(t)+(t.GeosetId!==null?ue("GeosetId",t.GeosetId):Zi("GeosetId","Multiple"))+(t.GeosetAnimId!==null?ue("GeosetAnimId",t.GeosetAnimId):Zi("GeosetAnimId","None"))+X()}function Ac(t){return t.Lights.length?t.Lights.map(Ec).join(""):""}function Ec(t){return H("Light",t.Name)+ct(t)+K(wc(t.LightType))+V("AttenuationStart",t.AttenuationStart)+V("AttenuationEnd",t.AttenuationEnd)+jt("Color",t.Color,!0)+V("Intensity",t.Intensity,null)+jt("AmbColor",t.AmbColor,!0)+V("AmbIntensity",t.AmbIntensity,null)+V("Visibility",t.Visibility,1)+X()}function wc(t){switch(t){case Qn.Omnidirectional:return"Omnidirectional";case Qn.Directional:return"Directional";case Qn.Ambient:return"Ambient"}return""}function Pc(t){return t.Helpers.map(Cc).join("")}function Cc(t){return H("Helper",t.Name)+ct(t)+X()}function Rc(t){return t.Attachments.map(Ic).join("")}function Ic(t){return H("Attachment",t.Name)+ct(t)+ue("AttachmentID",t.AttachmentID)+(t.Path?Ct("Path",t.Path):"")+V("Visibility",t.Visibility,1)+X()}function Lc(t){return H("PivotPoints",t.PivotPoints.length)+t.PivotPoints.map(e=>`${fe()}${at(e)},
`).join("")+X()}function Fc(t){return t.ParticleEmitters.map(Dc).join("")}function Dc(t){return H("ParticleEmitter",t.Name)+ct(t)+(t.Flags&ji.EmitterUsesMDL?K("EmitterUsesMDL"):"")+(t.Flags&ji.EmitterUsesTGA?K("EmitterUsesTGA"):"")+V("EmissionRate",t.EmissionRate)+V("Gravity",t.Gravity)+V("Longitude",t.Longitude)+V("Latitude",t.Latitude)+V("Visibility",t.Visibility)+H("Particle",null,1)+V("LifeSpan",t.LifeSpan,null,2)+V("InitVelocity",t.InitVelocity,null,2)+Ct("Path",t.Path,!1,2)+X(1)+X()}function Uc(t){return t.ParticleEmitters2.map(Vc).join("")}function Nc(t){switch(t){case on.Blend:return"Blend";case on.Additive:return"Additive";case on.Modulate:return"Modulate";case on.Modulate2x:return"Modulate2x";case on.AlphaKey:return"AlphaKey"}return""}function Bc(t){return H("SegmentColor",null,1)+t.map(e=>jt("Color",e,!1,2)).join("")+fe()+`},
`}function Oc(t){return t&Ve.Head&&t&Ve.Tail?"Both":t&Ve.Head?"Head":t&Ve.Tail?"Tail":""}function Vc(t){return H("ParticleEmitter2",t.Name)+ct(t)+K(Nc(t.FilterMode))+V("Speed",t.Speed,null)+V("Variation",t.Variation,null)+V("Latitude",t.Latitude,null)+V("Gravity",t.Gravity,null)+V("EmissionRate",t.EmissionRate,null)+V("Width",t.Width,null)+V("Length",t.Length,null)+V("Visibility",t.Visibility,1)+Bc(t.SegmentColor)+ds("Alpha",t.Alpha)+Ce("ParticleScaling",t.ParticleScaling)+Ce("LifeSpanUVAnim",t.LifeSpanUVAnim)+Ce("DecayUVAnim",t.DecayUVAnim)+Ce("TailUVAnim",t.TailUVAnim)+Ce("TailDecayUVAnim",t.TailDecayUVAnim)+ne("Rows",t.Rows,0)+ne("Columns",t.Columns,0)+ue("TextureID",t.TextureID)+ne("Time",t.Time,0)+ne("LifeSpan",t.LifeSpan,0)+ne("TailLength",t.TailLength,0)+ne("PriorityPlane",t.PriorityPlane,0)+ne("ReplaceableId",t.ReplaceableId,null)+(t.Flags&$t.SortPrimsFarZ?K("SortPrimsFarZ"):"")+(t.Flags&$t.LineEmitter?K("LineEmitter"):"")+(t.Flags&$t.ModelSpace?K("ModelSpace"):"")+(t.Flags&$t.Unshaded?K("Unshaded"):"")+(t.Flags&$t.Unfogged?K("Unfogged"):"")+(t.Flags&$t.XYQuad?K("XYQuad"):"")+(t.Squirt?K("Squirt"):"")+K(Oc(t.FrameFlags))+X()}function Gc(t){return t.RibbonEmitters.map(kc).join("")}function kc(t){return H("RibbonEmitter",t.Name)+ct(t)+V("HeightAbove",t.HeightAbove,null)+V("HeightBelow",t.HeightBelow,null)+V("Alpha",t.Alpha,null)+jt("Color",t.Color,!0)+V("TextureSlot",t.TextureSlot,null)+V("Visibility",t.Visibility,1)+ue("EmissionRate",t.EmissionRate)+ue("LifeSpan",t.LifeSpan)+ne("Gravity",t.Gravity,0)+ue("Rows",t.Rows)+ue("Columns",t.Columns)+ue("MaterialID",t.MaterialID)+X()}function zc(t){return t.EventObjects.map(Wc).join("")}function Hc(t){let e="";for(let n=0;n<t.length;++n)e+=fe(2)+t[n]+`,
`;return H("EventTrack",t.length,1)+e+X(1)}function Wc(t){return H("EventObject",t.Name)+ct(t)+Hc(t.EventTrack)+X()}function Xc(t){return t.Cameras.map(qc).join("")}function qc(t){return H("Camera",t.Name)+ln("FieldOfView",t.FieldOfView)+ln("FarClip",t.FarClip)+ln("NearClip",t.NearClip)+Ce("Position",t.Position)+V("Translation",t.Translation)+V("Rotation",t.Rotation)+H("Target",null,1)+Ce("Position",t.TargetPosition,null,2)+V("Translation",t.TargetTranslation,null,2)+X(1)+X()}function $c(t){return t.CollisionShapes.map(Yc).join("")}function Yc(t){let e;return t.Shape===gt.Box?(e=K("Box"),e+=H("Vertices",2,1)+fe(2)+at(t.Vertices.slice(0,3))+`,
`+fe(2)+at(t.Vertices.slice(3,6))+`,
`+X(1)):(e=K("Sphere"),e+=H("Vertices",1,1)+fe(2)+at(t.Vertices)+`,
`+X(1)+ln("BoundsRadius",t.BoundsRadius)),H("CollisionShape",t.Name)+ct(t)+e+X()}function Kc(t){return t.Version<900||!t.FaceFX?"":t.FaceFX.map(jc).join("")}function jc(t){return H("FaceFX",t.Name)+Ct("Path",t.Path)+X()}function Zc(t){return t.Version<900||!t.BindPoses?"":t.BindPoses.map(Jc).join("")}function Jc(t){let e=H("Matrices",t.Matrices.length,1)+t.Matrices.map(n=>fe(2)+at(n)+",").join(`
`)+`
`+X(1);return H("BindPose")+e+X()}function Qc(t){return t.Version<900||!t.ParticleEmitterPopcorns?"":t.ParticleEmitterPopcorns.map(eh).join("")}function eh(t){return H("ParticleEmitterPopcorn",t.Name)+ct(t)+(t.Flags&an.Unshaded?K("Unshaded"):"")+(t.Flags&an.SortPrimsFarZ?K("SortPrimsFarZ"):"")+(t.Flags&an.Unfogged?K("Unfogged"):"")+V("LifeSpan",t.LifeSpan,null)+V("EmissionRate",t.EmissionRate,0)+V("Speed",t.Speed,0)+jt("Color",t.Color,!0)+V("Alpha",t.Alpha,1)+ne("ReplaceableId",t.ReplaceableId,0,null)+Ct("Path",t.Path,!1)+Ct("AnimVisibilityGuide",t.AnimVisibilityGuide,!1)+V("Visibility",t.Visibility)+X()}var th=[ec,tc,nc,rc,sc,ac,uc,dc,_c,Mc,Ac,Pc,Rc,Lc,Fc,Uc,Gc,zc,Xc,$c,Kc,Zc,Qc];function ps(t){let e="";for(let n of th)e+=n(t);return e}var Zn=!0,vt=-1,nh=class{constructor(t){this.ab=t,this.uint=new Uint8Array(this.ab),this.view=new DataView(this.ab),this.pos=0}keyword(t){this.uint[this.pos]=t.charCodeAt(0),this.uint[this.pos+1]=t.charCodeAt(1),this.uint[this.pos+2]=t.charCodeAt(2),this.uint[this.pos+3]=t.charCodeAt(3),this.pos+=4}uint8(t){this.view.setUint8(this.pos,t),this.pos+=1}uint16(t){this.view.setUint16(this.pos,t,Zn),this.pos+=2}int32(t){this.view.setInt32(this.pos,t,Zn),this.pos+=4}uint32(t){this.view.setUint32(this.pos,t,Zn),this.pos+=4}float32(t){this.view.setFloat32(this.pos,t,Zn),this.pos+=4}float32Array(t){for(let e=0;e<t.length;++e)this.float32(t[e])}uint8Array(t){for(let e=0;e<t.length;++e)this.uint8(t[e])}uint16Array(t){for(let e=0;e<t.length;++e)this.uint16(t[e])}int32Array(t){for(let e=0;e<t.length;++e)this.int32(t[e])}uint32Array(t){for(let e=0;e<t.length;++e)this.uint32(t[e])}str(t,e){for(let n=0;n<e;++n,++this.pos)this.uint[this.pos]=n<t.length?t.charCodeAt(n):0}animVector(t,e){let n=e===S.INT1;this.int32(t.Keys.length),this.int32(t.LineType),this.int32(t.GlobalSeqId!==null?t.GlobalSeqId:vt);for(let i of t.Keys)this.int32(i.Frame),n?this.int32Array(i.Vector):this.float32Array(i.Vector),(t.LineType===Ne.Hermite||t.LineType===Ne.Bezier)&&(n?(this.int32Array(i.InTan),this.int32Array(i.OutTan)):(this.float32Array(i.InTan),this.float32Array(i.OutTan)))}};function ni(t,e){e.float32(t.BoundsRadius||0);for(let n of["MinimumExtent","MaximumExtent"])e.float32Array(t[n])}var S=(function(t){return t[t.INT1=0]="INT1",t[t.FLOAT1=1]="FLOAT1",t[t.FLOAT3=2]="FLOAT3",t[t.FLOAT4=3]="FLOAT4",t})(S||{}),ih={[S.INT1]:1,[S.FLOAT1]:1,[S.FLOAT3]:3,[S.FLOAT4]:4};function B(t,e){return 12+t.Keys.length*(4+4*ih[e]*(t.LineType===Ne.Hermite||t.LineType===Ne.Bezier?3:1))}function de(t){return t.reduce((e,n)=>e+n,0)}function rh(){return 12}function sh(t,e){e.keyword("VERS"),e.int32(4),e.int32(t.Version)}var ms=336;function gs(){return 8+ms+4+28+4}function oh(t,e){e.keyword("MODL"),e.int32(gs()-8),e.str(t.Info.Name,ms),e.int32(0),ni(t.Info,e),e.int32(t.Info.BlendTime)}var vs=80;function ah(){return vs+8+4+4+4+4+28}function xs(t){return t.Sequences.length?8+de(t.Sequences.map(ah)):0}function lh(t,e){if(t.Sequences.length){e.keyword("SEQS"),e.int32(xs(t)-8);for(let n of t.Sequences)e.str(n.Name,vs),e.int32(n.Interval[0]),e.int32(n.Interval[1]),e.float32(n.MoveSpeed),e.int32(n.NonLooping?1:0),e.float32(n.Rarity),e.int32(0),ni(n,e)}}function ch(t){return!t.GlobalSequences||!t.GlobalSequences.length?0:8+4*t.GlobalSequences.length}function hh(t,e){if(!(!t.GlobalSequences||!t.GlobalSequences.length)){e.keyword("GLBS"),e.int32(t.GlobalSequences.length*4);for(let n of t.GlobalSequences)e.int32(n)}}function ys(t,e){return 28+(t.Version>=900?4:0)+(t.Version>=1e3?20:0)+(t.Version>=1100?8+Yt.reduce((n,i)=>n+(typeof e[i]<"u"?8+(typeof e[i]=="object"?4+B(e[i],S.INT1):0):0),0):0)+(e.Alpha!==null&&typeof e.Alpha!="number"?4+B(e.Alpha,S.FLOAT1):0)+(t.Version<1100&&e.TextureID!==null&&typeof e.TextureID!="number"?4+B(e.TextureID,S.INT1):0)+(t.Version>=900&&e.EmissiveGain!==void 0&&e.EmissiveGain!==null&&typeof e.EmissiveGain!="number"?4+B(e.EmissiveGain,S.FLOAT1):0)+(t.Version>=1e3&&e.FresnelColor!==void 0&&e.FresnelColor!==null&&!(e.FresnelColor instanceof Float32Array)?4+B(e.FresnelColor,S.FLOAT3):0)+(t.Version>=1e3&&e.FresnelOpacity!==void 0&&e.FresnelOpacity!==null&&typeof e.FresnelOpacity!="number"?4+B(e.FresnelOpacity,S.FLOAT1):0)+(t.Version>=1e3&&e.FresnelTeamColor!==void 0&&e.FresnelTeamColor!==null&&typeof e.FresnelTeamColor!="number"?4+B(e.FresnelTeamColor,S.FLOAT1):0)}function _s(t,e){return 20+(t.Version>=900&&t.Version<1100?80:0)+de(e.Layers.map(n=>ys(t,n)))}function bs(t){return t.Materials.length?8+de(t.Materials.map(e=>_s(t,e))):0}function uh(t,e){if(t.Materials.length){e.keyword("MTLS"),e.int32(bs(t)-8);for(let n of t.Materials){e.int32(_s(t,n)),e.int32(n.PriorityPlane),e.int32(n.RenderMode),t.Version>=900&&t.Version<1100&&e.str(n.Shader||"",80),e.keyword("LAYS"),e.int32(n.Layers.length);for(let i of n.Layers){if(e.int32(ys(t,i)),e.int32(i.FilterMode),e.int32(i.Shading),e.int32(t.Version<1100&&typeof i.TextureID=="number"?i.TextureID:0),e.int32(i.TVertexAnimId!==null?i.TVertexAnimId:vt),e.int32(i.CoordId),e.float32(typeof i.Alpha=="number"?i.Alpha:1),t.Version>=900&&(e.float32(typeof i.EmissiveGain=="number"?i.EmissiveGain:1),t.Version>=1e3&&(e.float32Array(i.FresnelColor instanceof Float32Array?i.FresnelColor:new Float32Array([1,1,1])),e.float32(typeof i.FresnelOpacity=="number"?i.FresnelOpacity:0),e.float32(typeof i.FresnelTeamColor=="number"?i.FresnelTeamColor:0))),t.Version>=1100){e.int32(i.ShaderTypeId||0);let r=Yt.filter(s=>i[s]!==void 0).length;e.int32(r);for(let s=0;s<Yt.length;++s){let o=i[Yt[s]];o!==void 0&&(e.int32(typeof o=="number"?o:0),e.int32(typeof o=="number"?s:0),typeof o=="object"&&(e.keyword("KMTF"),e.animVector(o,S.INT1)))}}i.Alpha&&typeof i.Alpha!="number"&&(e.keyword("KMTA"),e.animVector(i.Alpha,S.FLOAT1)),t.Version<1100&&i.TextureID&&typeof i.TextureID!="number"&&(e.keyword("KMTF"),e.animVector(i.TextureID,S.INT1)),t.Version>=900&&i.EmissiveGain&&typeof i.EmissiveGain!="number"&&(e.keyword("KMTE"),e.animVector(i.EmissiveGain,S.FLOAT1)),t.Version>=1e3&&i.FresnelColor&&!(i.FresnelColor instanceof Float32Array)&&(e.keyword("KFC3"),e.animVector(i.FresnelColor,S.FLOAT3)),t.Version>=1e3&&i.FresnelOpacity&&typeof i.FresnelOpacity!="number"&&(e.keyword("KFCA"),e.animVector(i.FresnelOpacity,S.FLOAT1)),t.Version>=1e3&&i.FresnelTeamColor&&typeof i.FresnelTeamColor!="number"&&(e.keyword("KFTC"),e.animVector(i.FresnelTeamColor,S.FLOAT1))}}}}var Ss=256;function fh(){return 4+Ss+4+4}function Ms(t){return t.Textures.length?8+de(t.Textures.map(e=>fh())):0}function dh(t,e){if(t.Textures.length){e.keyword("TEXS"),e.int32(Ms(t)-8);for(let n of t.Textures)e.int32(n.ReplaceableId),e.str(n.Image,Ss),e.int32(0),e.int32(n.Flags)}}function Ts(t){return 4+(t.Translation?4+B(t.Translation,S.FLOAT3):0)+(t.Rotation?4+B(t.Rotation,S.FLOAT4):0)+(t.Scaling?4+B(t.Scaling,S.FLOAT3):0)}function As(t){return!t.TextureAnims||!t.TextureAnims.length?0:8+de(t.TextureAnims.map(e=>Ts(e)))}function ph(t,e){if(!(!t.TextureAnims||!t.TextureAnims.length)){e.keyword("TXAN"),e.int32(As(t)-8);for(let n of t.TextureAnims)e.int32(Ts(n)),n.Translation&&(e.keyword("KTAT"),e.animVector(n.Translation,S.FLOAT3)),n.Rotation&&(e.keyword("KTAR"),e.animVector(n.Rotation,S.FLOAT4)),n.Scaling&&(e.keyword("KTAS"),e.animVector(n.Scaling,S.FLOAT3))}}function Es(t,e){return 12+4*e.Vertices.length+4+4+4*e.Normals.length+4+4+4+4+4+4+4+4+2*e.Faces.length+4+4+e.VertexGroup.length+4+4+4*e.Groups.length+4+4+4*e.TotalGroupsCount+4+4+4+(t.Version>=900?84:0)+(t.Version>=900&&e.Tangents?.length?8+4*e.Tangents.length:0)+(t.Version>=900&&e.SkinWeights?.length?8+e.SkinWeights.length:0)+28+4+28*e.Anims.length+4+4+de(e.TVertices.map(n=>8+4*n.length))}function ws(t){return t.Geosets.length?8+de(t.Geosets.map(e=>Es(t,e))):0}function mh(t,e){if(t.Geosets.length){e.keyword("GEOS"),e.int32(ws(t)-8);for(let n of t.Geosets){e.int32(Es(t,n)),e.keyword("VRTX"),e.int32(n.Vertices.length/3),e.float32Array(n.Vertices),e.keyword("NRMS"),e.int32(n.Normals.length/3),e.float32Array(n.Normals),e.keyword("PTYP"),e.int32(1),e.int32(4),e.keyword("PCNT"),e.int32(1),e.int32(n.Faces.length),e.keyword("PVTX"),e.int32(n.Faces.length),e.uint16Array(n.Faces),e.keyword("GNDX"),e.int32(n.VertexGroup.length),e.uint8Array(n.VertexGroup),e.keyword("MTGC"),e.int32(n.Groups.length);for(let i=0;i<n.Groups.length;++i)e.int32(n.Groups[i].length);e.keyword("MATS"),e.int32(n.TotalGroupsCount);for(let i of n.Groups)for(let r of i)e.int32(r);e.int32(n.MaterialID),e.int32(n.SelectionGroup),e.int32(n.Unselectable?4:0),t.Version>=900&&(e.int32(typeof n.LevelOfDetail=="number"?n.LevelOfDetail:-1),e.str(n.Name||"",80)),ni(n,e),e.int32(n.Anims.length);for(let i of n.Anims)ni(i,e);t.Version>=900&&(n.Tangents&&n.Tangents.length&&(e.keyword("TANG"),e.int32(n.Tangents.length/4),e.float32Array(n.Tangents)),n.SkinWeights&&n.SkinWeights.length&&(e.keyword("SKIN"),e.int32(n.SkinWeights.length),e.uint8Array(n.SkinWeights))),e.keyword("UVAS"),e.int32(n.TVertices.length);for(let i of n.TVertices)e.keyword("UVBS"),e.int32(i.length/2),e.float32Array(i)}}}function Ps(t){return 28+(typeof t.Alpha!="number"?4+B(t.Alpha,S.FLOAT1):0)+(t.Color&&!(t.Color instanceof Float32Array)?4+B(t.Color,S.FLOAT3):0)}function Cs(t){return t.GeosetAnims.length?8+de(t.GeosetAnims.map(e=>Ps(e))):0}function gh(t,e){if(t.GeosetAnims.length){e.keyword("GEOA"),e.int32(Cs(t)-8);for(let n of t.GeosetAnims)e.int32(Ps(n)),e.float32(typeof n.Alpha=="number"?n.Alpha:1),e.int32(n.Flags),n.Color&&n.Color instanceof Float32Array?(e.float32(n.Color[0]),e.float32(n.Color[1]),e.float32(n.Color[2])):(e.float32(1),e.float32(1),e.float32(1)),e.int32(n.GeosetId!==null?n.GeosetId:vt),n.Alpha!==null&&typeof n.Alpha!="number"&&(e.keyword("KGAO"),e.animVector(n.Alpha,S.FLOAT1)),n.Color&&!(n.Color instanceof Float32Array)&&(e.keyword("KGAC"),e.animVector(n.Color,S.FLOAT3))}}var Rs=80;function Qe(t){return 4+Rs+4+4+4+(t.Translation?4+B(t.Translation,S.FLOAT3):0)+(t.Rotation?4+B(t.Rotation,S.FLOAT4):0)+(t.Scaling?4+B(t.Scaling,S.FLOAT3):0)}function vh(t){return Qe(t)+4+4}function Is(t){return t.Bones.length?8+de(t.Bones.map(vh)):0}function ht(t,e){e.int32(Qe(t)),e.str(t.Name,Rs),e.int32(t.ObjectId!==null?t.ObjectId:vt),e.int32(t.Parent!==null?t.Parent:vt),e.int32(t.Flags),t.Translation&&(e.keyword("KGTR"),e.animVector(t.Translation,S.FLOAT3)),t.Rotation&&(e.keyword("KGRT"),e.animVector(t.Rotation,S.FLOAT4)),t.Scaling&&(e.keyword("KGSC"),e.animVector(t.Scaling,S.FLOAT3))}function xh(t,e){if(t.Bones.length){e.keyword("BONE"),e.int32(Is(t)-8);for(let n of t.Bones)ht(n,e),e.int32(n.GeosetId!==null?n.GeosetId:vt),e.int32(n.GeosetAnimId!==null?n.GeosetAnimId:vt)}}function Ls(t){return 4+Qe(t)+4+4+4+12+4+12+4+(t.Visibility?4+B(t.Visibility,S.FLOAT1):0)+(t.Color&&!(t.Color instanceof Float32Array)?4+B(t.Color,S.FLOAT3):0)+(t.Intensity&&typeof t.Intensity!="number"?4+B(t.Intensity,S.FLOAT1):0)+(t.AttenuationStart&&typeof t.AttenuationStart!="number"?4+B(t.AttenuationStart,S.FLOAT1):0)+(t.AttenuationEnd&&typeof t.AttenuationEnd!="number"?4+B(t.AttenuationEnd,S.FLOAT1):0)+(t.AmbColor&&!(t.AmbColor instanceof Float32Array)?4+B(t.AmbColor,S.FLOAT3):0)+(t.AmbIntensity&&typeof t.AmbIntensity!="number"?4+B(t.AmbIntensity,S.FLOAT1):0)}function Fs(t){return t.Lights.length?8+de(t.Lights.map(Ls)):0}function yh(t,e){if(t.Lights.length){e.keyword("LITE"),e.int32(Fs(t)-8);for(let n of t.Lights)e.int32(Ls(n)),ht(n,e),e.int32(n.LightType),e.float32(typeof n.AttenuationStart=="number"?n.AttenuationStart:0),e.float32(typeof n.AttenuationEnd=="number"?n.AttenuationEnd:0),n.Color instanceof Float32Array?(e.float32(n.Color[0]),e.float32(n.Color[1]),e.float32(n.Color[2])):(e.float32(1),e.float32(1),e.float32(1)),e.float32(typeof n.Intensity=="number"?n.Intensity:0),n.AmbColor instanceof Float32Array?(e.float32(n.AmbColor[0]),e.float32(n.AmbColor[1]),e.float32(n.AmbColor[2])):(e.float32(1),e.float32(1),e.float32(1)),e.float32(typeof n.AmbIntensity=="number"?n.AmbIntensity:0),n.Intensity&&typeof n.Intensity!="number"&&(e.keyword("KLAI"),e.animVector(n.Intensity,S.FLOAT1)),n.Visibility&&(e.keyword("KLAV"),e.animVector(n.Visibility,S.FLOAT1)),n.Color&&!(n.Color instanceof Float32Array)&&(e.keyword("KLAC"),e.animVector(n.Color,S.FLOAT3)),n.AmbColor&&!(n.AmbColor instanceof Float32Array)&&(e.keyword("KLBC"),e.animVector(n.AmbColor,S.FLOAT3)),n.AmbIntensity&&typeof n.AmbIntensity!="number"&&(e.keyword("KLBI"),e.animVector(n.AmbIntensity,S.FLOAT1)),n.AttenuationStart&&typeof n.AttenuationStart!="number"&&(e.keyword("KLAS"),e.animVector(n.AttenuationStart,S.INT1)),n.AttenuationEnd&&typeof n.AttenuationEnd!="number"&&(e.keyword("KLAE"),e.animVector(n.AttenuationEnd,S.INT1))}}function Ds(t){return t.Helpers.length===0?0:8+de(t.Helpers.map(Qe))}function _h(t,e){if(t.Helpers.length!==0){e.keyword("HELP"),e.int32(Ds(t)-8);for(let n of t.Helpers)ht(n,e)}}var Us=256;function Ns(t){return 4+Qe(t)+Us+4+4+(t.Visibility?4+B(t.Visibility,S.FLOAT1):0)}function Bs(t){return t.Attachments.length===0?0:8+de(t.Attachments.map(Ns))}function bh(t,e){if(t.Attachments.length!==0){e.keyword("ATCH"),e.int32(Bs(t)-8);for(let n of t.Attachments)e.int32(Ns(n)),ht(n,e),e.str(n.Path||"",Us),e.int32(0),e.int32(n.AttachmentID),n.Visibility&&(e.keyword("KATV"),e.animVector(n.Visibility,S.FLOAT1))}}function Sh(t){return t.PivotPoints.length?8+12*t.PivotPoints.length:0}function Mh(t,e){if(t.PivotPoints.length){e.keyword("PIVT"),e.int32(t.PivotPoints.length*4*3);for(let n of t.PivotPoints)e.float32Array(n)}}var Os=256;function Vs(t){return 4+Qe(t)+4+4+4+4+Os+4+4+4+(t.Visibility&&typeof t.Visibility!="number"?4+B(t.Visibility,S.FLOAT1):0)+(t.EmissionRate&&typeof t.EmissionRate!="number"?4+B(t.EmissionRate,S.FLOAT1):0)+(t.Gravity&&typeof t.Gravity!="number"?4+B(t.Gravity,S.FLOAT1):0)+(t.Longitude&&typeof t.Longitude!="number"?4+B(t.Longitude,S.FLOAT1):0)+(t.Latitude&&typeof t.Latitude!="number"?4+B(t.Latitude,S.FLOAT1):0)+(t.LifeSpan&&typeof t.LifeSpan!="number"?4+B(t.LifeSpan,S.FLOAT1):0)+(t.InitVelocity&&typeof t.InitVelocity!="number"?4+B(t.InitVelocity,S.FLOAT1):0)}function Gs(t){return t.ParticleEmitters.length?8+de(t.ParticleEmitters.map(Vs)):0}function Th(t,e){if(t.ParticleEmitters.length){e.keyword("PREM"),e.int32(Gs(t)-8);for(let n of t.ParticleEmitters)e.int32(Vs(n)),ht(n,e),e.float32(typeof n.EmissionRate=="number"?n.EmissionRate:0),e.float32(typeof n.Gravity=="number"?n.Gravity:0),e.float32(typeof n.Longitude=="number"?n.Longitude:0),e.float32(typeof n.Latitude=="number"?n.Latitude:0),e.str(n.Path,Os),e.int32(0),e.float32(typeof n.LifeSpan=="number"?n.LifeSpan:0),e.float32(typeof n.InitVelocity=="number"?n.InitVelocity:0),n.Visibility&&typeof n.Visibility!="number"&&(e.keyword("KPEV"),e.animVector(n.Visibility,S.FLOAT1)),n.EmissionRate&&typeof n.EmissionRate!="number"&&(e.keyword("KPEE"),e.animVector(n.EmissionRate,S.FLOAT1)),n.Gravity&&typeof n.Gravity!="number"&&(e.keyword("KPEG"),e.animVector(n.Gravity,S.FLOAT1)),n.Longitude&&typeof n.Longitude!="number"&&(e.keyword("KPLN"),e.animVector(n.Longitude,S.FLOAT1)),n.Latitude&&typeof n.Latitude!="number"&&(e.keyword("KPLT"),e.animVector(n.Latitude,S.FLOAT1)),n.LifeSpan&&typeof n.LifeSpan!="number"&&(e.keyword("KPEL"),e.animVector(n.LifeSpan,S.FLOAT1)),n.InitVelocity&&typeof n.InitVelocity!="number"&&(e.keyword("KPES"),e.animVector(n.InitVelocity,S.FLOAT1))}}function ks(t){return 4+Qe(t)+4+4+4+4+4+4+4+4+4+4+4+4+4+4+36+3+12+12+12+12+12+4+4+4+4+(t.Visibility&&typeof t.Visibility!="number"?4+B(t.Visibility,S.FLOAT1):0)+(t.EmissionRate&&typeof t.EmissionRate!="number"?4+B(t.EmissionRate,S.FLOAT1):0)+(t.Width&&typeof t.Width!="number"?4+B(t.Width,S.FLOAT1):0)+(t.Length&&typeof t.Length!="number"?4+B(t.Length,S.FLOAT1):0)+(t.Speed&&typeof t.Speed!="number"?4+B(t.Speed,S.FLOAT1):0)+(t.Latitude&&typeof t.Latitude!="number"?4+B(t.Latitude,S.FLOAT1):0)+(t.Gravity&&typeof t.Gravity!="number"?4+B(t.Gravity,S.FLOAT1):0)+(t.Variation&&typeof t.Variation!="number"?4+B(t.Variation,S.FLOAT1):0)}function zs(t){return t.ParticleEmitters2.length?8+de(t.ParticleEmitters2.map(ks)):0}function Ah(t,e){if(t.ParticleEmitters2.length){e.keyword("PRE2"),e.int32(zs(t)-8);for(let n of t.ParticleEmitters2){e.int32(ks(n)),ht(n,e),e.float32(typeof n.Speed=="number"?n.Speed:0),e.float32(typeof n.Variation=="number"?n.Variation:0),e.float32(typeof n.Latitude=="number"?n.Latitude:0),e.float32(typeof n.Gravity=="number"?n.Gravity:0),e.float32(n.LifeSpan),e.float32(typeof n.EmissionRate=="number"?n.EmissionRate:0),e.float32(typeof n.Width=="number"?n.Width:0),e.float32(typeof n.Length=="number"?n.Length:0),e.int32(n.FilterMode),e.int32(n.Rows),e.int32(n.Columns),n.FrameFlags&Ve.Head&&n.FrameFlags&Ve.Tail?e.int32(2):n.FrameFlags&Ve.Tail?e.int32(1):n.FrameFlags&Ve.Head&&e.int32(0),e.float32(n.TailLength),e.float32(n.Time);for(let i=0;i<3;++i)for(let r=0;r<3;++r)e.float32(n.SegmentColor[i][r]);for(let i=0;i<3;++i)e.uint8(n.Alpha[i]);for(let i=0;i<3;++i)e.float32(n.ParticleScaling[i]);for(let i of["LifeSpanUVAnim","DecayUVAnim","TailUVAnim","TailDecayUVAnim"])for(let r=0;r<3;++r)e.int32(n[i][r]);e.int32(n.TextureID!==null?n.TextureID:vt),e.int32(n.Squirt?1:0),e.int32(n.PriorityPlane),e.int32(n.ReplaceableId),n.Speed&&typeof n.Speed!="number"&&(e.keyword("KP2S"),e.animVector(n.Speed,S.FLOAT1)),n.Latitude&&typeof n.Latitude!="number"&&(e.keyword("KP2L"),e.animVector(n.Latitude,S.FLOAT1)),n.EmissionRate&&typeof n.EmissionRate!="number"&&(e.keyword("KP2E"),e.animVector(n.EmissionRate,S.FLOAT1)),n.Visibility&&typeof n.Visibility!="number"&&(e.keyword("KP2V"),e.animVector(n.Visibility,S.FLOAT1)),n.Length&&typeof n.Length!="number"&&(e.keyword("KP2N"),e.animVector(n.Length,S.FLOAT1)),n.Width&&typeof n.Width!="number"&&(e.keyword("KP2W"),e.animVector(n.Width,S.FLOAT1)),n.Gravity&&typeof n.Gravity!="number"&&(e.keyword("KP2G"),e.animVector(n.Gravity,S.FLOAT1)),n.Variation&&typeof n.Variation!="number"&&(e.keyword("KP2R"),e.animVector(n.Variation,S.FLOAT1))}}}function Hs(t){return 4+Qe(t)+4+4+4+12+4+4+4+4+4+4+4+(t.Visibility?4+B(t.Visibility,S.FLOAT1):0)+(typeof t.HeightAbove!="number"?4+B(t.HeightAbove,S.FLOAT1):0)+(typeof t.HeightBelow!="number"?4+B(t.HeightBelow,S.FLOAT1):0)+(typeof t.Alpha!="number"?4+B(t.Alpha,S.FLOAT1):0)+(typeof t.TextureSlot!="number"?4+B(t.TextureSlot,S.FLOAT1):0)}function Ws(t){return t.RibbonEmitters.length?8+de(t.RibbonEmitters.map(Hs)):0}function Eh(t,e){if(t.RibbonEmitters.length){e.keyword("RIBB"),e.int32(Ws(t)-8);for(let n of t.RibbonEmitters)e.int32(Hs(n)),ht(n,e),e.float32(typeof n.HeightAbove=="number"?n.HeightAbove:0),e.float32(typeof n.HeightBelow=="number"?n.HeightBelow:0),e.float32(typeof n.Alpha=="number"?n.Alpha:0),n.Color?e.float32Array(n.Color):(e.float32(1),e.float32(1),e.float32(1)),e.float32(n.LifeSpan),e.int32(typeof n.TextureSlot=="number"?n.TextureSlot:0),e.int32(n.EmissionRate),e.int32(n.Rows),e.int32(n.Columns),e.int32(n.MaterialID),e.float32(n.Gravity),n.Visibility&&(e.keyword("KRVS"),e.animVector(n.Visibility,S.FLOAT1)),typeof n.HeightAbove!="number"&&(e.keyword("KRHA"),e.animVector(n.HeightAbove,S.FLOAT1)),typeof n.HeightBelow!="number"&&(e.keyword("KRHB"),e.animVector(n.HeightBelow,S.FLOAT1)),typeof n.Alpha!="number"&&(e.keyword("KRAL"),e.animVector(n.Alpha,S.FLOAT1)),typeof n.TextureSlot!="number"&&(e.keyword("KRTX"),e.animVector(n.TextureSlot,S.INT1))}}var Xs=80;function qs(t){return 4+Xs+12+4+4+4+12+(t.Translation?4+B(t.Translation,S.FLOAT3):0)+(t.TargetTranslation?4+B(t.TargetTranslation,S.FLOAT3):0)+(t.Rotation?4+B(t.Rotation,S.FLOAT1):0)}function $s(t){return t.Cameras.length?8+de(t.Cameras.map(qs)):0}function wh(t,e){if(t.Cameras.length){e.keyword("CAMS"),e.int32($s(t)-8);for(let n of t.Cameras)e.int32(qs(n)),e.str(n.Name,Xs),e.float32Array(n.Position),e.float32(n.FieldOfView),e.float32(n.FarClip),e.float32(n.NearClip),e.float32Array(n.TargetPosition),n.Translation&&(e.keyword("KCTR"),e.animVector(n.Translation,S.FLOAT3)),n.Rotation&&(e.keyword("KCRL"),e.animVector(n.Rotation,S.FLOAT1)),n.TargetTranslation&&(e.keyword("KTTR"),e.animVector(n.TargetTranslation,S.FLOAT3))}}function Ph(t){return Qe(t)+4+4+4+4*t.EventTrack.length}function Ys(t){return t.EventObjects.length===0?0:8+de(t.EventObjects.map(Ph))}function Ch(t,e){if(t.EventObjects.length!==0){e.keyword("EVTS"),e.int32(Ys(t)-8);for(let n of t.EventObjects)ht(n,e),e.keyword("KEVT"),e.int32(n.EventTrack.length),e.int32(vt),e.uint32Array(n.EventTrack)}}function Rh(t){return Qe(t)+4+(t.Shape===gt.Box?6:3)*4+(t.Shape===gt.Sphere?4:0)}function Ks(t){return t.CollisionShapes.length===0?0:8+de(t.CollisionShapes.map(Rh))}function Ih(t,e){if(t.CollisionShapes.length!==0){e.keyword("CLID"),e.int32(Ks(t)-8);for(let n of t.CollisionShapes)ht(n,e),e.int32(n.Shape),e.float32Array(n.Vertices),n.Shape===gt.Sphere&&e.float32(n.BoundsRadius)}}function js(t){return t.Version<900||!t.FaceFX?0:8+340*t.FaceFX.length}function Lh(t,e){if(!(t.Version<900||!t.FaceFX)){e.keyword("FAFX"),e.int32(js(t)-8);for(let n of t.FaceFX)e.str(n.Name,80),e.str(n.Path,260)}}function Fh(t){return 48*t.Matrices.length}function Zs(t){return t.Version<900||!t.BindPoses?0:12+de(t.BindPoses.map(Fh))}function Dh(t,e){if(t.Version<900||!t.BindPoses?.length)return;e.keyword("BPOS"),e.int32(Zs(t)-8);let n=t.BindPoses.reduce((i,r)=>i+r.Matrices.length,0);e.int32(n);for(let i of t.BindPoses)for(let r of i.Matrices)e.float32Array(r)}function Js(t){return 4+Qe(t)+4+4+4+12+4+4+260+260+(t.Alpha&&typeof t.Alpha!="number"?4+B(t.Alpha,S.FLOAT1):0)+(t.Visibility&&typeof t.Visibility!="number"?4+B(t.Visibility,S.FLOAT1):0)+(t.EmissionRate&&typeof t.EmissionRate!="number"?4+B(t.EmissionRate,S.FLOAT1):0)+(t.Color&&!(t.Color instanceof Float32Array)?4+B(t.Color,S.FLOAT3):0)+(t.LifeSpan&&typeof t.LifeSpan!="number"?4+B(t.LifeSpan,S.FLOAT1):0)+(t.Speed&&typeof t.Speed!="number"?4+B(t.Speed,S.FLOAT1):0)}function Qs(t){return t.Version<900||!t.ParticleEmitterPopcorns?.length?0:8+de(t.ParticleEmitterPopcorns.map(Js))}function Uh(t,e){if(!(t.Version<900||!t.ParticleEmitterPopcorns?.length)){e.keyword("CORN"),e.int32(Qs(t)-8);for(let n of t.ParticleEmitterPopcorns)e.int32(Js(n)),ht(n,e),e.float32(typeof n.LifeSpan=="number"?n.LifeSpan:0),e.float32(typeof n.EmissionRate=="number"?n.EmissionRate:1),e.float32(typeof n.Speed=="number"?n.Speed:0),n.Color instanceof Float32Array?(e.float32(n.Color[0]),e.float32(n.Color[1]),e.float32(n.Color[2])):(e.float32(1),e.float32(1),e.float32(1)),e.float32(typeof n.Alpha=="number"?n.Alpha:1),e.int32(typeof n.ReplaceableId=="number"?n.ReplaceableId:0),e.str(n.Path,260),e.str(n.AnimVisibilityGuide,260),n.Alpha&&typeof n.Alpha!="number"&&(e.keyword("KPPA"),e.animVector(n.Alpha,S.FLOAT1)),n.Color&&!(n.Color instanceof Float32Array)&&(e.keyword("KPPC"),e.animVector(n.Color,S.FLOAT3)),n.EmissionRate&&typeof n.EmissionRate!="number"&&(e.keyword("KPPE"),e.animVector(n.EmissionRate,S.FLOAT1)),n.LifeSpan&&typeof n.LifeSpan!="number"&&(e.keyword("KPPL"),e.animVector(n.LifeSpan,S.FLOAT1)),n.Speed&&typeof n.Speed!="number"&&(e.keyword("KPPS"),e.animVector(n.Speed,S.FLOAT1)),n.Visibility&&typeof n.Visibility!="number"&&(e.keyword("KPPV"),e.animVector(n.Visibility,S.FLOAT1))}}var Nh=[rh,gs,xs,ch,bs,Ms,As,ws,Cs,Is,Fs,Ds,Bs,Sh,Gs,zs,Qs,Ws,$s,Ys,Ks,js,Zs],Bh=[sh,oh,lh,hh,uh,dh,ph,mh,gh,xh,yh,_h,bh,Mh,Th,Ah,Uh,Eh,wh,Ch,Ih,Lh,Dh];function eo(t){let e=4;for(let r of Nh)e+=r(t);let n=new ArrayBuffer(e),i=new nh(n);i.keyword("MDLX");for(let r of Bh)r(t,i);return n}var Hp=(function(){"use strict";var e=new Int32Array([0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63]),n=4017,i=799,r=3406,s=2276,o=1567,a=3784,c=5793,h=2896;function l(){}function d(g,y){for(var v=0,b=[],M,_,T=16;T>0&&!g[T-1];)T--;b.push({children:[],index:0});var P=b[0],A;for(M=0;M<T;M++){for(_=0;_<g[M];_++){for(P=b.pop(),P.children[P.index]=y[v];P.index>0;)P=b.pop();for(P.index++,b.push(P);b.length<=M;)b.push(A={children:[],index:0}),P.children[P.index]=A.children,P=A;v++}M+1<T&&(b.push(A={children:[],index:0}),P.children[P.index]=A.children,P=A)}return b[0].children}function u(g,y,v){return 64*((g.blocksPerLine+1)*y+v)}function f(g,y,v,b,M,_,T,P,A){v.precision,v.samplesPerLine,v.scanLines;var O=v.mcusPerLine,N=v.progressive;v.maxH,v.maxV;var F=y,C=0,D=0;function w(){if(D>0)return D--,C>>D&1;if(C=g[y++],C==255){var G=g[y++];if(G)throw"unexpected marker: "+(C<<8|G).toString(16)}return D=7,C>>>7}function R(G){for(var Y=G,Z;(Z=w())!==null;){if(Y=Y[Z],typeof Y=="number")return Y;if(typeof Y!="object")throw"invalid huffman sequence"}return null}function oe(G){for(var Y=0;G>0;){var Z=w();if(Z===null)return;Y=Y<<1|Z,G--}return Y}function U(G){var Y=oe(G);return Y>=1<<G-1?Y:Y+(-1<<G)+1}function Ke(G,Y){var Z=R(G.huffmanTableDC),Q=Z===0?0:U(Z);G.blockData[Y]=G.pred+=Q;for(var te=1;te<64;){var me=R(G.huffmanTableAC),be=me&15,ot=me>>4;if(be===0){if(ot<15)break;te+=16;continue}te+=ot;var Hi=e[te];G.blockData[Y+Hi]=U(be),te++}}function Ee(G,Y){var Z=R(G.huffmanTableDC),Q=Z===0?0:U(Z)<<A;G.blockData[Y]=G.pred+=Q}function we(G,Y){G.blockData[Y]|=w()<<A}var De=0;function Tt(G,Y){if(De>0){De--;return}for(var Z=_,Q=T;Z<=Q;){var te=R(G.huffmanTableAC),me=te&15,be=te>>4;if(me===0){if(be<15){De=oe(be)+(1<<be)-1;break}Z+=16;continue}Z+=be;var ot=e[Z];G.blockData[Y+ot]=U(me)*(1<<A),Z++}}var Ue=0,je;function zt(G,Y){for(var Z=_,Q=T,te=0;Z<=Q;){var me=e[Z];switch(Ue){case 0:var be=R(G.huffmanTableAC),ot=be&15,te=be>>4;if(ot===0)te<15?(De=oe(te)+(1<<te),Ue=4):(te=16,Ue=1);else{if(ot!==1)throw"invalid ACn encoding";je=U(ot),Ue=te?2:3}continue;case 1:case 2:G.blockData[Y+me]?G.blockData[Y+me]+=w()<<A:(te--,te===0&&(Ue=Ue==2?3:0));break;case 3:G.blockData[Y+me]?G.blockData[Y+me]+=w()<<A:(G.blockData[Y+me]=je<<A,Ue=0);break;case 4:G.blockData[Y+me]&&(G.blockData[Y+me]+=w()<<A);break}Z++}Ue===4&&(De--,De===0&&(Ue=0))}function Ht(G,Y,Z,Q,te){var me=Z/O|0,be=Z%O;Y(G,u(G,me*G.v+Q,be*G.h+te))}function At(G,Y,Z){Y(G,u(G,Z/G.blocksPerLine|0,Z%G.blocksPerLine))}var dt=b.length,Ze,Je,Wt,pt,mt,Xt;N?_===0?Xt=P===0?Ee:we:Xt=P===0?Tt:zt:Xt=Ke;var Et=0,ae,sn;dt==1?sn=b[0].blocksPerLine*b[0].blocksPerColumn:sn=O*v.mcusPerColumn,M||(M=sn);for(var Cn,jn;Et<sn;){for(Je=0;Je<dt;Je++)b[Je].pred=0;if(De=0,dt==1)for(Ze=b[0],mt=0;mt<M;mt++)At(Ze,Xt,Et),Et++;else for(mt=0;mt<M;mt++){for(Je=0;Je<dt;Je++)for(Ze=b[Je],Cn=Ze.h,jn=Ze.v,Wt=0;Wt<jn;Wt++)for(pt=0;pt<Cn;pt++)Ht(Ze,Xt,Et,Wt,pt);Et++}if(D=0,ae=g[y]<<8|g[y+1],ae<=65280)throw"marker was not found";if(ae>=65488&&ae<=65495)y+=2;else break}return y-F}function p(g,y,v){var b=g.quantizationTable,M,_,T,P,A,O,N,F,C,D;for(D=0;D<64;D++)v[D]=g.blockData[y+D]*b[D];for(D=0;D<8;++D){var w=8*D;if(v[1+w]==0&&v[2+w]==0&&v[3+w]==0&&v[4+w]==0&&v[5+w]==0&&v[6+w]==0&&v[7+w]==0){C=c*v[0+w]+512>>10,v[0+w]=C,v[1+w]=C,v[2+w]=C,v[3+w]=C,v[4+w]=C,v[5+w]=C,v[6+w]=C,v[7+w]=C;continue}M=c*v[0+w]+128>>8,_=c*v[4+w]+128>>8,T=v[2+w],P=v[6+w],A=h*(v[1+w]-v[7+w])+128>>8,F=h*(v[1+w]+v[7+w])+128>>8,O=v[3+w]<<4,N=v[5+w]<<4,C=M-_+1>>1,M=M+_+1>>1,_=C,C=T*a+P*o+128>>8,T=T*o-P*a+128>>8,P=C,C=A-N+1>>1,A=A+N+1>>1,N=C,C=F+O+1>>1,O=F-O+1>>1,F=C,C=M-P+1>>1,M=M+P+1>>1,P=C,C=_-T+1>>1,_=_+T+1>>1,T=C,C=A*s+F*r+2048>>12,A=A*r-F*s+2048>>12,F=C,C=O*i+N*n+2048>>12,O=O*n-N*i+2048>>12,N=C,v[0+w]=M+F,v[7+w]=M-F,v[1+w]=_+N,v[6+w]=_-N,v[2+w]=T+O,v[5+w]=T-O,v[3+w]=P+A,v[4+w]=P-A}for(D=0;D<8;++D){var R=D;if(v[8+R]==0&&v[16+R]==0&&v[24+R]==0&&v[32+R]==0&&v[40+R]==0&&v[48+R]==0&&v[56+R]==0){C=c*v[D+0]+8192>>14,v[0+R]=C,v[8+R]=C,v[16+R]=C,v[24+R]=C,v[32+R]=C,v[40+R]=C,v[48+R]=C,v[56+R]=C;continue}M=c*v[0+R]+2048>>12,_=c*v[32+R]+2048>>12,T=v[16+R],P=v[48+R],A=h*(v[8+R]-v[56+R])+2048>>12,F=h*(v[8+R]+v[56+R])+2048>>12,O=v[24+R],N=v[40+R],C=M-_+1>>1,M=M+_+1>>1,_=C,C=T*a+P*o+2048>>12,T=T*o-P*a+2048>>12,P=C,C=A-N+1>>1,A=A+N+1>>1,N=C,C=F+O+1>>1,O=F-O+1>>1,F=C,C=M-P+1>>1,M=M+P+1>>1,P=C,C=_-T+1>>1,_=_+T+1>>1,T=C,C=A*s+F*r+2048>>12,A=A*r-F*s+2048>>12,F=C,C=O*i+N*n+2048>>12,O=O*n-N*i+2048>>12,N=C,v[0+R]=M+F,v[56+R]=M-F,v[8+R]=_+N,v[48+R]=_-N,v[16+R]=T+O,v[40+R]=T-O,v[24+R]=P+A,v[32+R]=P-A}for(D=0;D<64;++D){var oe=y+D,U=v[D];U=U<=-2056?0:U>=2024?255:U+2056>>4,g.blockData[oe]=U}}function m(g,y){var v=y.blocksPerLine,b=y.blocksPerColumn;v<<3;for(var M=new Int32Array(64),_=0;_<b;_++)for(var T=0;T<v;T++)p(y,u(y,_,T),M);return y.blockData}function x(g){return g<=0?0:g>=255?255:g|0}return l.prototype={load:function(y){var v=new XMLHttpRequest;v.open("GET",y,!0),v.responseType="arraybuffer",v.onload=(function(){var b=new Uint8Array(v.response||v.mozResponseArrayBuffer);this.parse(b),this.onload&&this.onload()}).bind(this),v.send(null)},loadFromBuffer:function(y){this.parse(y),this.onload&&this.onload()},parse:function(y){function v(){var Q=y[_]<<8|y[_+1];return _+=2,Q}function b(){var Q=v(),te=y.subarray(_,_+Q-2);return _+=te.length,te}function M(Q){for(var te=Math.ceil(Q.samplesPerLine/8/Q.maxH),me=Math.ceil(Q.scanLines/8/Q.maxV),be=0;be<Q.components.length;be++){ae=Q.components[be];var ot=Math.ceil(Math.ceil(Q.samplesPerLine/8)*ae.h/Q.maxH),Hi=Math.ceil(Math.ceil(Q.scanLines/8)*ae.v/Q.maxV),Ra=te*ae.h,Ia=64*(me*ae.v)*(Ra+1);ae.blockData=new Int16Array(Ia),ae.blocksPerLine=ot,ae.blocksPerColumn=Hi}Q.mcusPerLine=te,Q.mcusPerColumn=me}var _=0;y.length;var T=null,P=null,A,O,N=[],F=[],C=[],D=v();if(D!=65496)throw"SOI not found";for(D=v();D!=65497;){var w,R,oe;switch(D){case 65504:case 65505:case 65506:case 65507:case 65508:case 65509:case 65510:case 65511:case 65512:case 65513:case 65514:case 65515:case 65516:case 65517:case 65518:case 65519:case 65534:var U=b();D===65504&&U[0]===74&&U[1]===70&&U[2]===73&&U[3]===70&&U[4]===0&&(T={version:{major:U[5],minor:U[6]},densityUnits:U[7],xDensity:U[8]<<8|U[9],yDensity:U[10]<<8|U[11],thumbWidth:U[12],thumbHeight:U[13],thumbData:U.subarray(14,14+3*U[12]*U[13])}),D===65518&&U[0]===65&&U[1]===100&&U[2]===111&&U[3]===98&&U[4]===101&&U[5]===0&&(P={version:U[6],flags0:U[7]<<8|U[8],flags1:U[9]<<8|U[10],transformCode:U[11]});break;case 65499:for(var Ke=v()+_-2;_<Ke;){var Ee=y[_++],we=new Int32Array(64);if(Ee>>4===0)for(R=0;R<64;R++){var De=e[R];we[De]=y[_++]}else if(Ee>>4===1)for(R=0;R<64;R++){var De=e[R];we[De]=v()}else throw"DQT: invalid table spec";N[Ee&15]=we}break;case 65472:case 65473:case 65474:if(A)throw"Only single frame JPEGs supported";v(),A={},A.extended=D===65473,A.progressive=D===65474,A.precision=y[_++],A.scanLines=v(),A.samplesPerLine=v(),A.components=[],A.componentIds={};var Tt=y[_++],Ue,je=0,zt=0;for(w=0;w<Tt;w++){Ue=y[_];var Ht=y[_+1]>>4,At=y[_+1]&15;je<Ht&&(je=Ht),zt<At&&(zt=At);var dt=y[_+2],oe=A.components.push({h:Ht,v:At,quantizationTable:N[dt]});A.componentIds[Ue]=oe-1,_+=3}A.maxH=je,A.maxV=zt,M(A);break;case 65476:var Ze=v();for(w=2;w<Ze;){var Je=y[_++],Wt=new Uint8Array(16),pt=0;for(R=0;R<16;R++,_++)pt+=Wt[R]=y[_];var mt=new Uint8Array(pt);for(R=0;R<pt;R++,_++)mt[R]=y[_];w+=17+pt,(Je>>4===0?C:F)[Je&15]=d(Wt,mt)}break;case 65501:v(),O=v();break;case 65498:v();var Xt=y[_++],Et=[],ae;for(w=0;w<Xt;w++){var sn=A.componentIds[y[_++]];ae=A.components[sn];var Cn=y[_++];ae.huffmanTableDC=C[Cn>>4],ae.huffmanTableAC=F[Cn&15],Et.push(ae)}var jn=y[_++],G=y[_++],Y=y[_++],Z=f(y,_,A,Et,O,jn,G,Y>>4,Y&15);_+=Z;break;default:if(y[_-3]==255&&y[_-2]>=192&&y[_-2]<=254){_-=3;break}throw"unknown JPEG marker "+D.toString(16)}D=v()}this.width=A.samplesPerLine,this.height=A.scanLines,this.jfif=T,this.adobe=P,this.components=[];for(var w=0;w<A.components.length;w++){var ae=A.components[w];this.components.push({output:m(A,ae),scaleX:ae.h/A.maxH,scaleY:ae.v/A.maxV,blocksPerLine:ae.blocksPerLine,blocksPerColumn:ae.blocksPerColumn})}},getData:function(y,v,b){var M=this.width/v,_=this.height/b,T,P,A,O,N,F,C=0,D=this.components.length;v*b*D;var w=y.data,R=new Uint8Array((this.components[0].blocksPerLine<<3)*this.components[0].blocksPerColumn*8);for(F=0;F<D;F++){T=this.components[F<3?2-F:F];for(var oe=T.blocksPerLine,U=T.blocksPerColumn,Ke=oe<<3,Ee,we,De=0,Tt=0;Tt<U;Tt++)for(var Ue=Tt<<3,je=0;je<oe;je++){var zt=u(T,Tt,je),C=0,Ht=je<<3;for(Ee=0;Ee<8;Ee++){var De=(Ue+Ee)*Ke;for(we=0;we<8;we++)R[De+Ht+we]=T.output[zt+C++]}}P=T.scaleX*M,A=T.scaleY*_,C=F;var At,dt,Ze;for(N=0;N<b;N++)for(O=0;O<v;O++)dt=0|N*A,At=0|O*P,Ze=dt*Ke+At,w[C]=R[Ze],C+=D}return w},copyToImageData:function(y){var v=y.width,b=y.height,M=v*b*4,_=y.data,T=this.getData(v,b),P=0,A=0,O,N,F,C,D,w,R,oe,U;switch(this.components.length){case 1:for(;A<M;)F=T[P++],_[A++]=F,_[A++]=F,_[A++]=F,_[A++]=255;break;case 3:for(;A<M;)R=T[P++],oe=T[P++],U=T[P++],_[A++]=R,_[A++]=oe,_[A++]=U,_[A++]=255;break;case 4:for(;A<M;)D=T[P++],w=T[P++],F=T[P++],C=T[P++],O=255-C,N=O/255,R=x(O-D*N),oe=x(O-w*N),U=x(O-F*N),_[A++]=R,_[A++]=oe,_[A++]=U,_[A++]=255;break;default:throw"Unsupported color mode"}}},l})();var We=typeof Float32Array<"u"?Float32Array:Array;Math.PI/180;Math.hypot||(Math.hypot=function(){for(var t=0,e=arguments.length;e--;)t+=arguments[e]*arguments[e];return Math.sqrt(t)});function tr(){var t=new We(9);return We!=Float32Array&&(t[1]=0,t[2]=0,t[3]=0,t[5]=0,t[6]=0,t[7]=0),t[0]=1,t[4]=1,t[8]=1,t}function ri(){var t=new We(16);return We!=Float32Array&&(t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0),t[0]=1,t[5]=1,t[10]=1,t[15]=1,t}function Re(){var t=new We(3);return We!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t}function Oh(t){var e=t[0],n=t[1],i=t[2];return Math.hypot(e,n,i)}function Fn(t,e,n){var i=new We(3);return i[0]=t,i[1]=e,i[2]=n,i}function Vh(t,e){var n=e[0],i=e[1],r=e[2],s=n*n+i*i+r*r;return s>0&&(s=1/Math.sqrt(s)),t[0]=e[0]*s,t[1]=e[1]*s,t[2]=e[2]*s,t}function Gh(t,e){return t[0]*e[0]+t[1]*e[1]+t[2]*e[2]}function Yi(t,e,n){var i=e[0],r=e[1],s=e[2],o=n[0],a=n[1],c=n[2];return t[0]=r*c-s*a,t[1]=s*o-i*c,t[2]=i*a-r*o,t}var kh=Oh;(function(){var t=Re();return function(e,n,i,r,s,o){var a,c;for(n||(n=3),i||(i=0),r?c=Math.min(r*n+i,e.length):c=e.length,a=i;a<c;a+=n)t[0]=e[a],t[1]=e[a+1],t[2]=e[a+2],s(t,t,o),e[a]=t[0],e[a+1]=t[1],e[a+2]=t[2];return e}})();function si(){var t=new We(4);return We!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0,t[3]=0),t}function zh(t,e,n,i){var r=new We(4);return r[0]=t,r[1]=e,r[2]=n,r[3]=i,r}function Hh(t,e){var n=e[0],i=e[1],r=e[2],s=e[3],o=n*n+i*i+r*r+s*s;return o>0&&(o=1/Math.sqrt(o)),t[0]=n*o,t[1]=i*o,t[2]=r*o,t[3]=s*o,t}(function(){var t=si();return function(e,n,i,r,s,o){var a,c;for(n||(n=4),i||(i=0),r?c=Math.min(r*n+i,e.length):c=e.length,a=i;a<c;a+=n)t[0]=e[a],t[1]=e[a+1],t[2]=e[a+2],t[3]=e[a+3],s(t,t,o),e[a]=t[0],e[a+1]=t[1],e[a+2]=t[2],e[a+3]=t[3];return e}})();function Dn(){var t=new We(4);return We!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t[3]=1,t}function Wh(t,e,n){n=n*.5;var i=Math.sin(n);return t[0]=i*e[0],t[1]=i*e[1],t[2]=i*e[2],t[3]=Math.cos(n),t}function Ki(t,e,n,i){var r=e[0],s=e[1],o=e[2],a=e[3],c=n[0],h=n[1],l=n[2],d=n[3],u,f=r*c+s*h+o*l+a*d,p,m,x;return f<0&&(f=-f,c=-c,h=-h,l=-l,d=-d),1-f>1e-6?(u=Math.acos(f),p=Math.sin(u),m=Math.sin((1-i)*u)/p,x=Math.sin(i*u)/p):(m=1-i,x=i),t[0]=m*r+x*c,t[1]=m*s+x*h,t[2]=m*o+x*l,t[3]=m*a+x*d,t}function Xh(t,e){var n=e[0]+e[4]+e[8],i;if(n>0)i=Math.sqrt(n+1),t[3]=.5*i,i=.5/i,t[0]=(e[5]-e[7])*i,t[1]=(e[6]-e[2])*i,t[2]=(e[1]-e[3])*i;else{var r=0;e[4]>e[0]&&(r=1),e[8]>e[r*3+r]&&(r=2);var s=(r+1)%3,o=(r+2)%3;i=Math.sqrt(e[r*3+r]-e[s*3+s]-e[o*3+o]+1),t[r]=.5*i,i=.5/i,t[3]=(e[s*3+o]-e[o*3+s])*i,t[s]=(e[s*3+r]+e[r*3+s])*i,t[o]=(e[o*3+r]+e[r*3+o])*i}return t}var qh=zh;var to=Hh,Wp=(function(){var t=Re(),e=Fn(1,0,0),n=Fn(0,1,0);return function(i,r,s){var o=Gh(r,s);return o<-.999999?(Yi(t,e,r),kh(t)<1e-6&&Yi(t,n,r),Vh(t,t),Wh(i,t,Math.PI),i):o>.999999?(i[0]=0,i[1]=0,i[2]=0,i[3]=1,i):(Yi(t,r,s),i[0]=t[0],i[1]=t[1],i[2]=t[2],i[3]=1+o,to(i,i))}})(),Xp=(function(){var t=Dn(),e=Dn();return function(n,i,r,s,o,a){return Ki(t,i,o,a),Ki(e,r,s,a),Ki(n,t,e,2*a*(1-a)),n}})();(function(){var t=tr();return function(e,n,i,r){return t[0]=i[0],t[3]=i[1],t[6]=i[2],t[1]=r[0],t[4]=r[1],t[7]=r[2],t[2]=-n[0],t[5]=-n[1],t[8]=-n[2],to(e,Xh(e,t))}})();var qp=Fn(0,0,0),$p=si(),Yp=si(),Kp=si(),jp=Re(),Zp=Re();var $h=`attribute vec3 aVertexPosition;
attribute vec3 aNormal;
attribute vec2 aTextureCoord;
attribute vec4 aGroup;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNodesMatrices[\${MAX_NODES}];

varying vec3 vNormal;
varying vec2 vTextureCoord;

void main(void) {
    vec4 position = vec4(aVertexPosition, 1.0);
    int count = 1;
    vec4 sum = uNodesMatrices[int(aGroup[0])] * position;

    if (aGroup[1] < \${MAX_NODES}.) {
        sum += uNodesMatrices[int(aGroup[1])] * position;
        count += 1;
    }
    if (aGroup[2] < \${MAX_NODES}.) {
        sum += uNodesMatrices[int(aGroup[2])] * position;
        count += 1;
    }
    if (aGroup[3] < \${MAX_NODES}.) {
        sum += uNodesMatrices[int(aGroup[3])] * position;
        count += 1;
    }
    sum.xyz /= float(count);
    sum.w = 1.;
    position = sum;

    gl_Position = uPMatrix * uMVMatrix * position;
    vTextureCoord = aTextureCoord;
    vNormal = aNormal;
}`;var Yh=`attribute vec3 aVertexPosition;
attribute vec3 aNormal;
attribute vec2 aTextureCoord;
attribute vec4 aSkin;
attribute vec4 aBoneWeight;
attribute vec4 aTangent;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNodesMatrices[\${MAX_NODES}];

varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBinormal;
varying vec2 vTextureCoord;
varying mat3 vTBN;
varying vec3 vFragPos;

void main(void) {
    vec4 position = vec4(aVertexPosition, 1.0);
    mat4 sum;

    // sum += uNodesMatrices[int(aSkin[0])] * 1.;
    sum += uNodesMatrices[int(aSkin[0])] * aBoneWeight[0];
    sum += uNodesMatrices[int(aSkin[1])] * aBoneWeight[1];
    sum += uNodesMatrices[int(aSkin[2])] * aBoneWeight[2];
    sum += uNodesMatrices[int(aSkin[3])] * aBoneWeight[3];

    mat3 rotation = mat3(sum);

    position = sum * position;
    position.w = 1.;

    gl_Position = uPMatrix * uMVMatrix * position;
    vTextureCoord = aTextureCoord;

    vec3 normal = aNormal;
    vec3 tangent = aTangent.xyz;

    // https://learnopengl.com/Advanced-Lighting/Normal-Mapping
    tangent = normalize(tangent - dot(tangent, normal) * normal);

    vec3 binormal = cross(normal, tangent) * aTangent.w;

    normal = normalize(rotation * normal);
    tangent = normalize(rotation * tangent);
    binormal = normalize(rotation * binormal);

    vNormal = normal;
    vTangent = tangent;
    vBinormal = binormal;

    vTBN = mat3(tangent, binormal, normal);

    vFragPos = position.xyz;
}`,Kh=`#version 300 es
in vec3 aVertexPosition;
in vec3 aNormal;
in vec2 aTextureCoord;
in vec4 aSkin;
in vec4 aBoneWeight;
in vec4 aTangent;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNodesMatrices[\${MAX_NODES}];

out vec3 vNormal;
out vec3 vTangent;
out vec3 vBinormal;
out vec2 vTextureCoord;
out mat3 vTBN;
out vec3 vFragPos;

void main(void) {
    vec4 position = vec4(aVertexPosition, 1.0);
    mat4 sum;

    // sum += uNodesMatrices[int(aSkin[0])] * 1.;
    sum += uNodesMatrices[int(aSkin[0])] * aBoneWeight[0];
    sum += uNodesMatrices[int(aSkin[1])] * aBoneWeight[1];
    sum += uNodesMatrices[int(aSkin[2])] * aBoneWeight[2];
    sum += uNodesMatrices[int(aSkin[3])] * aBoneWeight[3];

    mat3 rotation = mat3(sum);

    position = sum * position;
    position.w = 1.;

    gl_Position = uPMatrix * uMVMatrix * position;
    vTextureCoord = aTextureCoord;

    vec3 normal = aNormal;
    vec3 tangent = aTangent.xyz;

    // https://learnopengl.com/Advanced-Lighting/Normal-Mapping
    tangent = normalize(tangent - dot(tangent, normal) * normal);

    vec3 binormal = cross(normal, tangent) * aTangent.w;

    normal = normalize(rotation * normal);
    tangent = normalize(rotation * tangent);
    binormal = normalize(rotation * binormal);

    vNormal = normal;
    vTangent = tangent;
    vBinormal = binormal;

    vTBN = mat3(tangent, binormal, normal);

    vFragPos = position.xyz;
}`;var jh=`#version 300 es
precision mediump float;

in vec2 vTextureCoord;
in vec3 vNormal;
in vec3 vTangent;
in vec3 vBinormal;
in mat3 vTBN;
in vec3 vFragPos;

out vec4 FragColor;

uniform sampler2D uSampler;
uniform sampler2D uNormalSampler;
uniform sampler2D uOrmSampler;
uniform vec3 uReplaceableColor;
uniform float uDiscardAlphaLevel;
uniform mat3 uTVertexAnim;
uniform vec3 uLightPos;
uniform vec3 uLightColor;
uniform vec3 uCameraPos;
uniform vec3 uShadowParams;
uniform sampler2D uShadowMapSampler;
uniform mat4 uShadowMapLightMatrix;
uniform bool uHasEnv;
uniform samplerCube uIrradianceMap;
uniform samplerCube uPrefilteredEnv;
uniform sampler2D uBRDFLUT;
uniform float uWireframe;

const float PI = 3.14159265359;
const float gamma = 2.2;
const float MAX_REFLECTION_LOD = \${MAX_ENV_MIP_LEVELS};

float distributionGGX(vec3 normal, vec3 halfWay, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float nDotH = max(dot(normal, halfWay), 0.0);
    float nDotH2 = nDotH * nDotH;

    float num = a2;
    float denom = (nDotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return num / denom;
}

float geometrySchlickGGX(float nDotV, float roughness) {
    float r = roughness + 1.;
    float k = r * r / 8.;
    // float k = roughness * roughness / 2.;

    float num = nDotV;
    float denom = nDotV * (1. - k) + k;

    return num / denom;
}

float geometrySmith(vec3 normal, vec3 viewDir, vec3 lightDir, float roughness) {
    float nDotV = max(dot(normal, viewDir), .0);
    float nDotL = max(dot(normal, lightDir), .0);
    float ggx2  = geometrySchlickGGX(nDotV, roughness);
    float ggx1  = geometrySchlickGGX(nDotL, roughness);

    return ggx1 * ggx2;
}

vec3 fresnelSchlick(float lightFactor, vec3 f0) {
    return f0 + (1. - f0) * pow(clamp(1. - lightFactor, 0., 1.), 5.);
}

vec3 fresnelSchlickRoughness(float lightFactor, vec3 f0, float roughness) {
    return f0 + (max(vec3(1.0 - roughness), f0) - f0) * pow(clamp(1.0 - lightFactor, 0.0, 1.0), 5.0);
}

void main(void) {
    if (uWireframe > 0.) {
        FragColor = vec4(1.);
        return;
    }

    vec2 texCoord = (uTVertexAnim * vec3(vTextureCoord.s, vTextureCoord.t, 1.)).st;

    vec4 orm = texture(uOrmSampler, texCoord);

    float occlusion = orm.r;
    float roughness = orm.g;
    float metallic = orm.b;
    float teamColorFactor = orm.a;

    vec4 baseColor = texture(uSampler, texCoord);
    vec3 teamColor = baseColor.rgb * uReplaceableColor;
    baseColor.rgb = mix(baseColor.rgb, teamColor, teamColorFactor);
    baseColor.rgb = pow(baseColor.rgb, vec3(gamma));

    vec3 normal = texture(uNormalSampler, texCoord).rgb;
    normal = normal * 2.0 - 1.0;
    normal.x = -normal.x;
    normal.y = -normal.y;
    if (!gl_FrontFacing) {
        normal = -normal;
    }
    normal = normalize(vTBN * -normal);

    vec3 viewDir = normalize(uCameraPos - vFragPos);
    vec3 reflected = reflect(-viewDir, normal);

    vec3 lightDir = normalize(uLightPos - vFragPos);
    float lightFactor = max(dot(normal, lightDir), .0);
    vec3 radiance = uLightColor;

    vec3 f0 = vec3(.04);
    f0 = mix(f0, baseColor.rgb, metallic);

    vec3 totalLight = vec3(0.);
    vec3 halfWay = normalize(viewDir + lightDir);
    float ndf = distributionGGX(normal, halfWay, roughness);
    float g = geometrySmith(normal, viewDir, lightDir, roughness);
    vec3 f = fresnelSchlick(max(dot(halfWay, viewDir), 0.), f0);

    vec3 kS = f;
    vec3 kD = vec3(1.);// - kS;
    if (uHasEnv) {
        kD *= 1.0 - metallic;
    }
    vec3 num = ndf * g * f;
    float denom = 4. * max(dot(normal, viewDir), 0.) * max(dot(normal, lightDir), 0.) + .0001;
    vec3 specular = num / denom;

    totalLight = (kD * baseColor.rgb / PI + specular) * radiance * lightFactor;

    if (uShadowParams[0] > .5) {
        float shadowBias = uShadowParams[1];
        float shadowStep = uShadowParams[2];
        vec4 fragInLightPos = uShadowMapLightMatrix * vec4(vFragPos, 1.);
        vec3 shadowMapCoord = fragInLightPos.xyz / fragInLightPos.w;
        shadowMapCoord.xyz = (shadowMapCoord.xyz + 1.0) * .5;

        int passes = 5;
        float step = 1. / float(passes);

        float lightDepth = texture(uShadowMapSampler, shadowMapCoord.xy).r;
        float lightDepth0 = texture(uShadowMapSampler, vec2(shadowMapCoord.x + shadowStep, shadowMapCoord.y)).r;
        float lightDepth1 = texture(uShadowMapSampler, vec2(shadowMapCoord.x, shadowMapCoord.y + shadowStep)).r;
        float lightDepth2 = texture(uShadowMapSampler, vec2(shadowMapCoord.x, shadowMapCoord.y - shadowStep)).r;
        float lightDepth3 = texture(uShadowMapSampler, vec2(shadowMapCoord.x - shadowStep, shadowMapCoord.y)).r;
        float currentDepth = shadowMapCoord.z;

        float visibility = 0.;
        if (lightDepth > currentDepth - shadowBias) {
            visibility += step;
        }
        if (lightDepth0 > currentDepth - shadowBias) {
            visibility += step;
        }
        if (lightDepth1 > currentDepth - shadowBias) {
            visibility += step;
        }
        if (lightDepth2 > currentDepth - shadowBias) {
            visibility += step;
        }
        if (lightDepth3 > currentDepth - shadowBias) {
            visibility += step;
        }

        totalLight *= visibility;
    }

    vec3 color;

    if (uHasEnv) {
        vec3 f = fresnelSchlickRoughness(max(dot(normal, viewDir), 0.0), f0, roughness);
        vec3 kS = f;
        vec3 kD = vec3(1.0) - kS;
        kD *= 1.0 - metallic;

        vec3 diffuse = texture(uIrradianceMap, normal).rgb * baseColor.rgb;
        vec3 prefilteredColor = textureLod(uPrefilteredEnv, reflected, roughness * MAX_REFLECTION_LOD).rgb;
        vec2 envBRDF = texture(uBRDFLUT, vec2(max(dot(normal, viewDir), 0.0), roughness)).rg;
        specular = prefilteredColor * (f * envBRDF.x + envBRDF.y);

        vec3 ambient = (kD * diffuse + specular) * occlusion;
        color = ambient + totalLight;
    } else {
        vec3 ambient = vec3(.03);
        ambient *= baseColor.rgb * occlusion;
        color = ambient + totalLight;
    }

    color = color / (vec3(1.) + color);
    color = pow(color, vec3(1. / gamma));

    FragColor = vec4(color, baseColor.a);

    // hand-made alpha-test
    if (FragColor[3] < uDiscardAlphaLevel) {
        discard;
    }
}
`;var Zh=`struct VSUniforms {
    mvMatrix: mat4x4f,
    pMatrix: mat4x4f,
    nodesMatrices: array<mat4x4f, \${MAX_NODES}>,
}

struct FSUniforms {
    replaceableColor: vec3f,
    replaceableType: u32,
    discardAlphaLevel: f32,
    wireframe: u32,
    tVertexAnim: mat3x3f,
}

@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
@group(1) @binding(0) var<uniform> fsUniforms: FSUniforms;
@group(1) @binding(1) var fsUniformSampler: sampler;
@group(1) @binding(2) var fsUniformTexture: texture_2d<f32>;

struct VSIn {
    @location(0) vertexPosition: vec3f,
    @location(1) normal: vec3f,
    @location(2) textureCoord: vec2f,
    @location(3) group: vec4<u32>,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    @location(1) textureCoord: vec2f,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    var position: vec4f = vec4f(in.vertexPosition, 1.0);
    var count: i32 = 1;
    var sum: vec4f = vsUniforms.nodesMatrices[in.group[0]] * position;

    if (in.group[1] < \${MAX_NODES}) {
        sum += vsUniforms.nodesMatrices[in.group[1]] * position;
        count += 1;
    }
    if (in.group[2] < \${MAX_NODES}) {
        sum += vsUniforms.nodesMatrices[in.group[2]] * position;
        count += 1;
    }
    if (in.group[3] < \${MAX_NODES}) {
        sum += vsUniforms.nodesMatrices[in.group[3]] * position;
        count += 1;
    }
    sum /= f32(count);
    sum.w = 1.;
    position = sum;

    var out: VSOut;
    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * position;
    out.textureCoord = in.textureCoord;
    out.normal = in.normal;
    return out;
}

fn hypot(z: vec2f) -> f32 {
    var t: f32 = 0;
    var x: f32 = abs(z.x);
    let y: f32 = abs(z.y);
    t = min(x, y);
    x = max(x, y);
    t = t / x;
    if (z.x == 0.0 && z.y == 0.0) {
        return 0.0;
    }
    return x * sqrt(1.0 + t * t);
}

@fragment fn fs(
    in: VSOut
) -> @location(0) vec4f {
    if (fsUniforms.wireframe > 0) {
        return vec4f(1);
    }

    let texCoord: vec2f = (fsUniforms.tVertexAnim * vec3f(in.textureCoord.x, in.textureCoord.y, 1.)).xy;
    var color: vec4f = vec4f(0.0);

    if (fsUniforms.replaceableType == 0) {
        color = textureSample(fsUniformTexture, fsUniformSampler, texCoord);
    } else if (fsUniforms.replaceableType == 1) {
        color = vec4f(fsUniforms.replaceableColor, 1.0);
    } else if (fsUniforms.replaceableType == 2) {
        let dist: f32 = hypot(texCoord - vec2(0.5, 0.5)) * 2.;
        let truncateDist: f32 = clamp(1. - dist * 1.4, 0., 1.);
        let alpha: f32 = sin(truncateDist);
        color = vec4f(fsUniforms.replaceableColor * alpha, 1.0);
    }

    // hand-made alpha-test
    if (color.a < fsUniforms.discardAlphaLevel) {
        discard;
    }

    return color;
}
`,Jh=`struct VSUniforms {
    mvMatrix: mat4x4f,
    pMatrix: mat4x4f,
    nodesMatrices: array<mat4x4f, \${MAX_NODES}>,
}

struct FSUniforms {
    replaceableColor: vec3f,
    // replaceableType: u32,
    discardAlphaLevel: f32,
    tVertexAnim: mat3x3f,
    lightPos: vec3f,
    hasEnv: u32,
    lightColor: vec3f,
    wireframe: u32,
    cameraPos: vec3f,
    shadowParams: vec3f,
    shadowMapLightMatrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
@group(1) @binding(0) var<uniform> fsUniforms: FSUniforms;
@group(1) @binding(1) var fsUniformDiffuseSampler: sampler;
@group(1) @binding(2) var fsUniformDiffuseTexture: texture_2d<f32>;
@group(1) @binding(3) var fsUniformNormalSampler: sampler;
@group(1) @binding(4) var fsUniformNormalTexture: texture_2d<f32>;
@group(1) @binding(5) var fsUniformOrmSampler: sampler;
@group(1) @binding(6) var fsUniformOrmTexture: texture_2d<f32>;
@group(1) @binding(7) var fsUniformShadowSampler: sampler_comparison;
@group(1) @binding(8) var fsUniformShadowTexture: texture_depth_2d;
@group(1) @binding(9) var irradienceMapSampler: sampler;
@group(1) @binding(10) var irradienceMapTexture: texture_cube<f32>;
@group(1) @binding(11) var prefilteredEnvSampler: sampler;
@group(1) @binding(12) var prefilteredEnvTexture: texture_cube<f32>;
@group(1) @binding(13) var brdfLutSampler: sampler;
@group(1) @binding(14) var brdfLutTexture: texture_2d<f32>;

struct VSIn {
    @location(0) vertexPosition: vec3f,
    @location(1) normal: vec3f,
    @location(2) textureCoord: vec2f,
    @location(3) tangent: vec4f,
    @location(4) skin: vec4<u32>,
    @location(5) boneWeight: vec4f,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) normal: vec3f,
    @location(1) textureCoord: vec2f,
    @location(2) tangent: vec3f,
    @location(3) binormal: vec3f,
    @location(4) fragPos: vec3f,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    var position: vec4f = vec4f(in.vertexPosition, 1.0);
    var sum: mat4x4f;

    sum += vsUniforms.nodesMatrices[in.skin[0]] * in.boneWeight[0];
    sum += vsUniforms.nodesMatrices[in.skin[1]] * in.boneWeight[1];
    sum += vsUniforms.nodesMatrices[in.skin[2]] * in.boneWeight[2];
    sum += vsUniforms.nodesMatrices[in.skin[3]] * in.boneWeight[3];

    let rotation: mat3x3f = mat3x3f(sum[0].xyz, sum[1].xyz, sum[2].xyz);

    position = sum * position;
    position.w = 1;

    var out: VSOut;
    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * position;
    out.textureCoord = in.textureCoord;
    out.normal = in.normal;

    var normal: vec3f = in.normal;
    var tangent: vec3f = in.tangent.xyz;

    // https://learnopengl.com/Advanced-Lighting/Normal-Mapping
    tangent = normalize(tangent - dot(tangent, normal) * normal);

    var binormal: vec3f = cross(normal, tangent) * in.tangent.w;

    normal = normalize(rotation * normal);
    tangent = normalize(rotation * tangent);
    binormal = normalize(rotation * binormal);

    out.normal = normal;
    out.tangent = tangent;
    out.binormal = binormal;

    out.fragPos = position.xyz;

    return out;
}

fn hypot(z: vec2f) -> f32 {
    var t: f32 = 0;
    var x: f32 = abs(z.x);
    let y: f32 = abs(z.y);
    t = min(x, y);
    x = max(x, y);
    t = t / x;
    if (z.x == 0.0 && z.y == 0.0) {
        return 0.0;
    }
    return x * sqrt(1.0 + t * t);
}

const PI: f32 = 3.14159265359;
const gamma: f32 = 2.2;
const MAX_REFLECTION_LOD: f32 = \${MAX_ENV_MIP_LEVELS};

fn distributionGGX(normal: vec3f, halfWay: vec3f, roughness: f32) -> f32 {
    let a: f32 = roughness * roughness;
    let a2: f32 = a * a;
    let nDotH: f32 = max(dot(normal, halfWay), 0.0);
    let nDotH2: f32 = nDotH * nDotH;

    let num: f32 = a2;
    var denom: f32 = (nDotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return num / denom;
}

fn geometrySchlickGGX(nDotV: f32, roughness: f32) -> f32 {
    let r: f32 = roughness + 1.;
    let k: f32 = r * r / 8.;
    // float k = roughness * roughness / 2.;

    let num: f32 = nDotV;
    let denom: f32 = nDotV * (1. - k) + k;

    return num / denom;
}

fn geometrySmith(normal: vec3f, viewDir: vec3f, lightDir: vec3f, roughness: f32) -> f32 {
    let nDotV: f32 = max(dot(normal, viewDir), .0);
    let nDotL: f32 = max(dot(normal, lightDir), .0);
    let ggx2: f32  = geometrySchlickGGX(nDotV, roughness);
    let ggx1: f32  = geometrySchlickGGX(nDotL, roughness);

    return ggx1 * ggx2;
}

fn fresnelSchlick(lightFactor: f32, f0: vec3f) -> vec3f {
    return f0 + (1. - f0) * pow(clamp(1. - lightFactor, 0., 1.), 5.);
}

fn fresnelSchlickRoughness(lightFactor: f32, f0: vec3f, roughness: f32) -> vec3f {
    return f0 + (max(vec3(1.0 - roughness), f0) - f0) * pow(clamp(1.0 - lightFactor, 0.0, 1.0), 5.0);
}

@fragment fn fs(
    in: VSOut,
    @builtin(front_facing) isFront: bool
) -> @location(0) vec4f {
    if (fsUniforms.wireframe > 0) {
        return vec4f(1);
    }

    let texCoord: vec2f = (fsUniforms.tVertexAnim * vec3f(in.textureCoord.x, in.textureCoord.y, 1.)).xy;
    var baseColor: vec4f = textureSample(fsUniformDiffuseTexture, fsUniformDiffuseSampler, texCoord);

    // hand-made alpha-test
    if (baseColor.a < fsUniforms.discardAlphaLevel) {
        discard;
    }

    let orm: vec4f = textureSample(fsUniformOrmTexture, fsUniformOrmSampler, texCoord);

    let occlusion: f32 = orm.r;
    let roughness: f32 = orm.g;
    let metallic: f32 = orm.b;
    let teamColorFactor: f32 = orm.a;

    var teamColor: vec3f = baseColor.rgb * fsUniforms.replaceableColor;
    baseColor = vec4(mix(baseColor.rgb, teamColor, teamColorFactor), baseColor.a);
    baseColor = vec4(pow(baseColor.rgb, vec3f(gamma)), baseColor.a);

    let TBN: mat3x3f = mat3x3f(in.tangent, in.binormal, in.normal);

    var normal: vec3f = textureSample(fsUniformNormalTexture, fsUniformNormalSampler, texCoord).xyz;
    normal = normal * 2 - 1;
    normal.x = -normal.x;
    normal.y = -normal.y;
    if (!isFront) {
        normal = -normal;
    }
    normal = normalize(TBN * -normal);

    let viewDir: vec3f = normalize(fsUniforms.cameraPos - in.fragPos);
    let reflected = reflect(-viewDir, normal);

    let lightDir: vec3f = normalize(fsUniforms.lightPos - in.fragPos);
    let lightFactor: f32 = max(dot(normal, lightDir), 0);
    let radiance: vec3f = fsUniforms.lightColor;

    var f0 = vec3f(.04);
    f0 = mix(f0, baseColor.rgb, metallic);

    var totalLight: vec3f = vec3f(0);
    let halfWay: vec3f = normalize(viewDir + lightDir);
    let ndf: f32 = distributionGGX(normal, halfWay, roughness);
    let g: f32 = geometrySmith(normal, viewDir, lightDir, roughness);
    let f: vec3f = fresnelSchlick(max(dot(halfWay, viewDir), 0), f0);

    let kS = f;
    var kD = vec3f(1);// - kS;
    if (fsUniforms.hasEnv > 0) {
        kD *= 1 - metallic;
    }
    let num: vec3f = ndf * g * f;
    let denom: f32 = 4. * max(dot(normal, viewDir), 0.) * max(dot(normal, lightDir), 0.) + .0001;
    var specular: vec3f = num / denom;

    totalLight = (kD * baseColor.rgb / PI + specular) * radiance * lightFactor;

    if (fsUniforms.shadowParams[0] > .5) {
        let shadowBias: f32 = fsUniforms.shadowParams[1];
        let shadowStep: f32 = fsUniforms.shadowParams[2];
        let fragInLightPos: vec4f = fsUniforms.shadowMapLightMatrix * vec4f(in.fragPos, 1.);
        var shadowMapCoord: vec3f = fragInLightPos.xyz / fragInLightPos.w;
        shadowMapCoord = vec3f((shadowMapCoord.xy + 1) * .5, shadowMapCoord.z);
        shadowMapCoord.y = 1 - shadowMapCoord.y;

        let passes: u32 = 5;
        let step: f32 = 1. / f32(passes);

        let currentDepth: f32 = shadowMapCoord.z;
        var lightDepth: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, shadowMapCoord.xy, currentDepth - shadowBias);
        let lightDepth0: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, vec2f(shadowMapCoord.x + shadowStep, shadowMapCoord.y), currentDepth - shadowBias);
        let lightDepth1: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, vec2f(shadowMapCoord.x, shadowMapCoord.y + shadowStep), currentDepth - shadowBias);
        let lightDepth2: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, vec2f(shadowMapCoord.x, shadowMapCoord.y - shadowStep), currentDepth - shadowBias);
        let lightDepth3: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, vec2f(shadowMapCoord.x - shadowStep, shadowMapCoord.y), currentDepth - shadowBias);

        var visibility: f32 = 0.;
        if (lightDepth > .5) {
            visibility += step;
        }
        if (lightDepth0 > .5) {
            visibility += step;
        }
        if (lightDepth1 > .5) {
            visibility += step;
        }
        if (lightDepth2 > .5) {
            visibility += step;
        }
        if (lightDepth3 > .5) {
            visibility += step;
        }

        totalLight *= visibility;
    }

    var color: vec3f = vec3f(0.0);

    if (fsUniforms.hasEnv > 0) {
        let f: vec3f = fresnelSchlickRoughness(max(dot(normal, viewDir), 0.0), f0, roughness);
        let kS: vec3f = f;
        var kD: vec3f = vec3f(1.0) - kS;
        kD *= 1.0 - metallic;

        let diffuse: vec3f = textureSample(irradienceMapTexture, irradienceMapSampler, normal).rgb * baseColor.rgb;
        let prefilteredColor: vec3f = textureSampleLevel(prefilteredEnvTexture, prefilteredEnvSampler, reflected, roughness * MAX_REFLECTION_LOD).rgb;
        let envBRDF: vec2f = textureSample(brdfLutTexture, brdfLutSampler, vec2f(max(dot(normal, viewDir), 0.0), roughness)).rg;
        specular = prefilteredColor * (f * envBRDF.x + envBRDF.y);

        let ambient: vec3f = (kD * diffuse + specular) * occlusion;
        color = ambient + totalLight;
    } else {
        var ambient: vec3f = vec3(.03);
        ambient *= baseColor.rgb * occlusion;
        color = ambient + totalLight;
    }

    color = color / (vec3f(1) + color);
    color = pow(color, vec3f(1 / gamma));

    return vec4f(color, baseColor.a);
}
`,Qh=`struct VSUniforms {
    mvMatrix: mat4x4f,
    pMatrix: mat4x4f,
    nodesMatrices: array<mat4x4f, \${MAX_NODES}>,
}

struct FSUniforms {
    replaceableColor: vec3f,
    // replaceableType: u32,
    discardAlphaLevel: f32,
    tVertexAnim: mat3x3f,
    lightPos: vec3f,
    lightColor: vec3f,
    cameraPos: vec3f,
    shadowParams: vec3f,
    shadowMapLightMatrix: mat4x4f,
    // env
}

@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;
@group(1) @binding(0) var<uniform> fsUniforms: FSUniforms;
@group(1) @binding(1) var fsUniformDiffuseSampler: sampler;
@group(1) @binding(2) var fsUniformDiffuseTexture: texture_2d<f32>;
@group(1) @binding(3) var fsUniformNormalSampler: sampler;
@group(1) @binding(4) var fsUniformNormalTexture: texture_2d<f32>;
@group(1) @binding(5) var fsUniformOrmSampler: sampler;
@group(1) @binding(6) var fsUniformOrmTexture: texture_2d<f32>;
@group(1) @binding(7) var fsUniformShadowSampler: sampler_comparison;
// @group(1) @binding(7) var fsUniformShadowSampler: sampler;
@group(1) @binding(8) var fsUniformShadowTexture: texture_depth_2d;

struct VSIn {
    @location(0) vertexPosition: vec3f,
    @location(1) normal: vec3f,
    @location(2) textureCoord: vec2f,
    @location(3) tangent: vec4f,
    @location(4) skin: vec4<u32>,
    @location(5) boneWeight: vec4f,
}

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) textureCoord: vec2f,
    @location(1) depth: f32,
}

@vertex fn vs(
    in: VSIn
) -> VSOut {
    var position: vec4f = vec4f(in.vertexPosition, 1.0);
    var sum: mat4x4f;

    sum += vsUniforms.nodesMatrices[in.skin[0]] * in.boneWeight[0];
    sum += vsUniforms.nodesMatrices[in.skin[1]] * in.boneWeight[1];
    sum += vsUniforms.nodesMatrices[in.skin[2]] * in.boneWeight[2];
    sum += vsUniforms.nodesMatrices[in.skin[3]] * in.boneWeight[3];

    position = sum * position;
    position.w = 1;

    var out: VSOut;
    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * position;
    out.textureCoord = in.textureCoord;

    out.depth = out.position.z / out.position.w;

    return out;
}

struct FSOut {
    @builtin(frag_depth) depth: f32,
    @location(0) color: vec4f
}

@fragment fn fs(
    in: VSOut,
    @builtin(front_facing) isFront: bool
) -> FSOut {
    let texCoord: vec2f = (fsUniforms.tVertexAnim * vec3f(in.textureCoord.x, in.textureCoord.y, 1.)).xy;
    var baseColor: vec4f = textureSample(fsUniformDiffuseTexture, fsUniformDiffuseSampler, texCoord);

    // hand-made alpha-test
    if (baseColor.a < fsUniforms.discardAlphaLevel) {
        discard;
    }

    var out: FSOut;
    out.color = vec4f(1, 1, 1, 1);
    out.depth = in.depth;
    return out;
}
`;var un=254;var no=8;var Jp=$h.replace(/\$\{MAX_NODES}/g,String(un)),Qp=Yh.replace(/\$\{MAX_NODES}/g,String(un)),em=Kh.replace(/\$\{MAX_NODES}/g,String(un)),tm=jh.replace(/\$\{MAX_ENV_MIP_LEVELS}/g,String(no.toFixed(1))),nm=Zh.replace(/\$\{MAX_NODES}/g,String(un)),im=Jh.replace(/\$\{MAX_NODES}/g,String(un)).replace(/\$\{MAX_ENV_MIP_LEVELS}/g,String(no.toFixed(1))),rm=Qh.replace(/\$\{MAX_NODES}/g,String(un)),sm=Re(),om=Dn(),am=Re(),lm=Fn(0,0,0),cm=qh(0,0,0,1),hm=Fn(1,1,1),um=Dn(),fm=ri(),dm=ri(),pm=Re(),mm=Re(),gm=Dn(),vm=ri(),xm=Re(),ym=Re(),_m=Re(),bm=Re(),Sm=Re(),Mm=Re(),Tm=Re(),Am=tr(),Em=ri(),wm=tr();import{Buffer as q}from"buffer";import{Buffer as It}from"buffer";function Ge(t,e,n,i,r={}){return Object.freeze({severity:t,code:e,message:n,offset:i,...r})}var eu=It.from("MDLX","ascii"),xt=Object.freeze([800,900,1e3,1100,1200,1300,1400,1600,1800]);function tu(t){if(It.isBuffer(t))return It.from(t);if(t instanceof Uint8Array)return It.from(t.buffer,t.byteOffset,t.byteLength);throw new TypeError("Expected a Buffer or Uint8Array")}function oi(t){return t.toString("latin1")}var ai=class{#e;constructor(e,n,i,r,s){this.#e=e,this.chunks=n,this.trailingBytes=i,this.diagnostics=r,this.version=s}get hasErrors(){return this.diagnostics.some(e=>e.severity==="error")}toBytes(){return It.from(this.#e)}summary(){return{format:"mdx",byteLength:this.#e.length,magic:this.#e.subarray(0,4).toString("latin1"),version:this.version,supportedVersion:xt.includes(this.version),chunks:this.chunks.map(e=>({tag:e.tag,offset:e.offset,declaredSize:e.declaredSize,actualSize:e.data.length,complete:e.complete})),trailingByteLength:this.trailingBytes.length,diagnostics:this.diagnostics}}};function et(t){let e=tu(t),n=[],i=[];if(e.length<4||!e.subarray(0,4).equals(eu))return n.push(Ge("error","MDX_INVALID_MAGIC","Expected the four-byte MDLX signature.",0,{actual:e.subarray(0,Math.min(4,e.length)).toString("hex")})),new ai(e,i,e.subarray(Math.min(4,e.length)),n,null);let r=4,s=It.alloc(0);for(;r<e.length;){let c=e.length-r;if(c<8){s=e.subarray(r),n.push(Ge("error","MDX_TRUNCATED_CHUNK_HEADER",`A top-level chunk header needs 8 bytes; only ${c} remain.`,r,{remaining:c}));break}let h=e.subarray(r,r+4),l=e.readUInt32LE(r+4),d=r+8,u=e.length-d,f=Math.min(l,u),p=f===l,m=e.subarray(d,d+f);if(i.push(Object.freeze({tag:oi(h),tagBytes:It.from(h),offset:r,payloadOffset:d,declaredSize:l,data:It.from(m),complete:p,known:nu(oi(h))})),!p){n.push(Ge("error","MDX_TRUNCATED_CHUNK_PAYLOAD",`Chunk ${JSON.stringify(oi(h))} declares ${l} bytes but only ${u} remain.`,r,{tag:oi(h),declaredSize:l,available:u})),r=e.length;break}r=d+l}let o=i.filter(c=>c.tag==="VERS"),a=null;if(o.length===0)n.push(Ge("warning","MDX_MISSING_VERSION","No VERS chunk was found.",4));else{o.length>1&&n.push(Ge("warning","MDX_DUPLICATE_VERSION",`Found ${o.length} VERS chunks; the first complete value is reported.`,o[1].offset,{count:o.length}));let c=o.find(h=>h.data.length>=4);for(let h of o.filter(l=>l.data.length<4))n.push(Ge("error","MDX_SHORT_VERSION_CHUNK","A VERS chunk must contain at least a 32-bit version value.",h.payloadOffset,{actualSize:h.data.length}));c&&(a=c.data.readUInt32LE(0))}return a!==null&&!xt.includes(a)&&n.push(Ge("warning","MDX_UNSUPPORTED_VERSION",`Format version ${a} is retained but has no semantic decoder yet.`,o.find(c=>c.data.length>=4).payloadOffset,{version:a,supportedVersions:xt})),new ai(e,i,s,n,a)}function nu(t){return new Set(["VERS","MODL","SEQS","GLBS","MTLS","TEXS","TXAN","GEOS","GEOA","BONE","LITE","HELP","ATCH","PIVT","PREM","PRE2","RIBB","CAMS","EVTS","CLID","FAFX","BPOS","CORN","DILG","SNDS","SNEM","MDVI"]).has(t)}var Lt=["TextureID","NormalTextureID","ORMTextureID","EmissiveTextureID","TeamColorTextureID","ReflectionsTextureID"],iu=t=>t.buffer.slice(t.byteOffset,t.byteOffset+t.byteLength),re=t=>{let e=q.alloc(4);return e.writeUInt32LE(t>>>0),e},tt=t=>{let e=q.alloc(4);return e.writeFloatLE(t),e},Jt=t=>q.concat(Array.from(t,tt)),fn=(t,e)=>{let n=q.alloc(e);return n.write(t||"",0,e,"latin1"),n},dn=(t,e,n)=>t.subarray(e,e+n).toString("latin1").split("\0")[0],Qt=(t,e,n=3)=>Float32Array.from({length:n},(i,r)=>t.readFloatLE(e+r*4)),li=t=>{let e=q.concat([re(0),...t]);return e.writeUInt32LE(e.length),e},nt=(t,e)=>q.concat([q.from(t),re(e.length),e]);function Se(t,e){let n=[];for(let i=0;i<t.length;){let r;if(e==="MODL")r=372;else if(e==="SEQS")r=132;else if(e==="TEXS")r=268;else if(e==="PIVT")r=12;else if(e==="GLBS"||e==="DILG")r=4;else{if(i+4>t.length)throw new Error(`Truncated ${e} record.`);if(r=t.readUInt32LE(i),e==="CAMS"&&(r&=16777215),e==="BONE"&&(r+=8),e==="EVTS"){if(r<96||i+r+12>t.length||t.toString("ascii",i+r,i+r+4)!=="KEVT")throw new Error("Invalid event record.");r+=12+t.readUInt32LE(i+r+4)*4}if(e==="CLID"){let s=t.readUInt32LE(i+r);if(s>3)throw new Error(`Unsupported collision shape ${s}.`);r+=4+(s===2?12:24)+(s>=2?4:0)}}if(r<4||i+r>t.length)throw new Error(`Invalid ${e} record size.`);n.push(t.subarray(i,i+r)),i+=r}return n}function ro(t,e,n=1,i=!1){if(e+16>t.length)throw new Error("Truncated animation header.");let r=t.readUInt32LE(e+4),s=t.readUInt32LE(e+8),o=t.readInt32LE(e+12);if(s>3)throw new Error("Invalid animation interpolation.");let a=16+r*(4+n*4*(s>=2?3:1));if(e+a>t.length)throw new Error("Truncated animation keys.");let c=e+16,h=[];for(let l=0;l<r;l++){let d={Frame:t.readInt32LE(c)};c+=4;for(let u of s>=2?["Vector","InTan","OutTan"]:["Vector"]){let f=i?Int32Array:Float32Array;d[u]=f.from({length:n},()=>{let p=i?t.readInt32LE(c):t.readFloatLE(c);return c+=4,p})}h.push(d)}return{track:{LineType:s,GlobalSeqId:o<0?null:o,Keys:h},size:a}}function so(t,e,n=!1){return e?.Keys?q.concat([q.from(t),re(e.Keys.length),re(e.LineType),re(e.GlobalSeqId??-1),...e.Keys.flatMap(i=>[re(i.Frame),...(e.LineType>=2?[i.Vector,i.InTan,i.OutTan]:[i.Vector]).map(r=>q.concat(Array.from(r,n?re:tt)))])]):q.alloc(0)}var oo={KMTA:["Alpha",1],KMTF:["TextureID",1,!0],KMTE:["EmissiveGain",1],KFC3:["FresnelColor",3],KFCA:["FresnelOpacity",1],KFTC:["FresnelTeamColor",1]},ao={KLAS:["AttenuationStart",1],KLAE:["AttenuationEnd",1],KLAC:["Color",3],KLAI:["Intensity",1],KLBC:["AmbColor",3],KLBI:["AmbIntensity",1],KLAV:["Visibility",1],KLSS:["ShadowCastingStart",1],KLSE:["ShadowCastingEnd",1],KLQF:["QuadraticFalloff",1],KLLF:["LinearFalloff",1],KLDA:["Damping",1]},lo={KRHA:["HeightAbove",1],KRHB:["HeightBelow",1],KRAL:["Alpha",1],KRCO:["Color",3],KRTX:["TextureSlot",1,!0],KRVS:["Visibility",1]},co={KCTR:["Translation",3],KCRL:["Rotation",1],KTTR:["TargetTranslation",3],KCVS:["Visibility",1],IDUF:["FocusDistance",1],ELAF:["FocalLength",1],PTSF:["FStop",1]},nr={PREM:{key:"ParticleEmitters",fields:[["EmissionRate",0],["Gravity",4],["Longitude",8],["Latitude",12],["LifeSpan",276],["InitVelocity",280]]},PRE2:{key:"ParticleEmitters2",fields:[["Speed",0],["Variation",4],["Latitude",8],["Gravity",12],["EmissionRate",20],["Length",24],["Width",28]]},CORN:{key:"ParticleEmitterPopcorns",fields:[["LifeSpan",0],["EmissionRate",4],["Speed",8],["Color",12,3],["Alpha",24]]}},ho=new Set(["KLAC","KLBC","KRCO"]);function uo(t){return t?.Keys?{...t,Keys:t.Keys.map(e=>{let n={...e};for(let i of["Vector","InTan","OutTan"])e[i]&&(n[i]=Float32Array.of(e[i][2],e[i][1],e[i][0]));return n})}:t}function ci(t,e,n,i){for(let r=e;r<t.length;){let s=t.toString("ascii",r,r+4),o=i[s];if(!o)throw new Error(`Unsupported animation ${s}.`);let[a,c,h]=o,{track:l,size:d}=ro(t,r,c,h);if(n[a]?.Keys)throw new Error(`Duplicate animation ${s}.`);n[a]!=null&&((n._MdxDefaults||={})[a]=n[a]),n[a]=ho.has(s)?uo(l):l,r+=d}}var hi=(t,e)=>Object.entries(e).map(([n,[i,,r]])=>so(n,ho.has(n)?uo(t[i]):t[i],r)),Be=(t,e,n=0)=>t[e]?.Keys?t._MdxDefaults?.[e]??n:t[e]??n;function ru(t,e){return Se(t,"MTLS").map(n=>{let i={PriorityPlane:n.readInt32LE(4),RenderMode:n.readUInt32LE(8),Layers:[]},r=12;if(e>=900&&e<1100&&(i.Shader=dn(n,r,80),r+=80),n.toString("ascii",r,r+4)!=="LAYS")throw new Error("Missing material layers.");let s=n.readUInt32LE(r+4);r+=8;for(let o=0;o<s;o++){let a=n.readUInt32LE(r),c=n.subarray(r,r+a);if(a<28||r+a>n.length)throw new Error("Invalid layer size.");let h={FilterMode:c.readUInt32LE(4),Shading:c.readUInt32LE(8),TextureID:c.readInt32LE(12),TVertexAnimId:c.readInt32LE(16),CoordId:c.readUInt32LE(20),Alpha:c.readFloatLE(24)};h.TVertexAnimId===-1&&(h.TVertexAnimId=null);let l=28;if(e>=900&&(h.EmissiveGain=c.readFloatLE(l),l+=4),e>=1e3&&(h.FresnelColor=Qt(c,l),h.FresnelOpacity=c.readFloatLE(l+12),h.FresnelTeamColor=c.readFloatLE(l+16),l+=20),e>=1100){h._MdxTextureId=h.TextureID,delete h.TextureID,h.ShaderTypeId=c.readUInt32LE(l);let d=c.readUInt32LE(l+4);l+=8,h._MdxSlots=[];for(let u=0;u<d;u++){let f=c.readInt32LE(l),p=c.readUInt32LE(l+4),m=Lt[p];if(l+=8,!m||h._MdxSlots.includes(p))throw new Error(`Unsupported or duplicate texture slot ${p}.`);if(h._MdxSlots.push(p),h[m]=f,l+4<=c.length&&c.toString("ascii",l,l+4)==="KMTF"){let{track:x,size:g}=ro(c,l,1,!0);(h._MdxDefaults||={})[m]=f,h[m]=x,l+=g}}}ci(c,l,h,oo),i.Layers.push(h),r+=a}if(r!==n.length)throw new Error("Unrecognized material tail.");return i})}function su(t,e){return q.concat(t.map(n=>li([re(n.PriorityPlane),re(n.RenderMode),...e>=900&&e<1100?[fn(n.Shader,80)]:[],q.from("LAYS"),re(n.Layers.length),...n.Layers.map(i=>{let r=[re(i.FilterMode),re(i.Shading),re(e>=1100?i._MdxTextureId??0:Be(i,"TextureID")),re(i.TVertexAnimId??-1),re(i.CoordId),tt(Be(i,"Alpha",1))];if(e>=900&&r.push(tt(Be(i,"EmissiveGain",1))),e>=1e3&&r.push(Jt(Be(i,"FresnelColor",[1,1,1])),tt(Be(i,"FresnelOpacity")),tt(Be(i,"FresnelTeamColor"))),e>=1100){let s=[...new Set([...i._MdxSlots||[],...Lt.map((o,a)=>a)])].filter(o=>i[Lt[o]]!=null);r.push(re(i.ShaderTypeId),re(s.length));for(let o of s){let a=Lt[o];r.push(re(Be(i,a)),re(o),so("KMTF",i[a],!0))}}return r.push(...hi(i,Object.fromEntries(Object.entries(oo).filter(([s])=>s!=="KMTF"||e<1100)))),li(r)})])))}function ir(t,e){let n={},i=4,r=(o,a)=>{if(t.toString("ascii",i,i+4)!==o)throw new Error(`Missing geoset ${o}.`);let c=i,h=t.readUInt32LE(i+4);if(i+=8+h*a,i>t.length)throw new Error(`Truncated geoset ${o}.`);n[o]={start:c,end:i,count:h}};for(let[o,a]of[["VRTX",12],["NRMS",12],["PTYP",4],["PCNT",4],["PVTX",2],["GNDX",1],["MTGC",4],["MATS",4]])r(o,a);n.selection=i+8,i+=12+(e>=900?84:0)+28;let s=t.readUInt32LE(i);for(i+=4+s*28;i<t.length;){let o=t.toString("ascii",i,i+4);if(o==="TANG")r(o,16);else if(o==="SKIN")r(o,e>=1400?2:1);else{if(o==="UVAS")break;throw new Error(`Unsupported geoset subchunk ${o}.`)}}return n}function fo(t,e){let n=[],i=0;for(let{start:r,end:s,data:o}of e.sort((a,c)=>a.start-c.start))n.push(t.subarray(i,r),o),i=s;return n.push(t.subarray(i)),q.concat(n)}function ou(t,e,n,i){let r=4+t.readUInt32LE(4),s=i||{},o=(a,c=1,h=!1)=>{s[a]=c===3?Qt(t,r):h?t.readUInt32LE(r):t.readFloatLE(r),r+=c*4};if(e==="LITE")o("LightType",1,!0),n>=1300&&o("ShadowCasting",1,!0),o("AttenuationStart"),o("AttenuationEnd"),o("Color",3),o("Intensity"),o("AmbColor",3),o("AmbIntensity"),n>=1200&&o("ShadowIntensity"),n>=1300&&(o("ShadowCastingStart"),o("ShadowCastingEnd")),n>=1600&&(o("QuadraticFalloff"),o("LinearFalloff"),o("Damping")),ci(t,r,s,ao);else{for(let[a,c,h]of[["HeightAbove",1],["HeightBelow",1],["Alpha",1],["Color",3],["LifeSpan",1],["TextureSlot",1,!0],["EmissionRate",1,!0],["Rows",1,!0],["Columns",1,!0],["MaterialID",1,!0],["Gravity",1]])o(a,c,h);ci(t,r,s,lo)}return s}function au(t,e,n,i){let r=[t.subarray(4,4+t.readUInt32LE(4))],s=(o,a=1,c=!1,h=0)=>r.push(a===3?Jt(Be(e,o,[1,1,1])):c?re(Be(e,o,h)):tt(Be(e,o,h)));if(n==="LITE")s("LightType",1,!0),i>=1300&&s("ShadowCasting",1,!0),s("AttenuationStart"),s("AttenuationEnd"),s("Color",3),s("Intensity"),s("AmbColor",3),s("AmbIntensity"),i>=1200&&s("ShadowIntensity"),i>=1300&&(s("ShadowCastingStart"),s("ShadowCastingEnd")),i>=1600&&(s("QuadraticFalloff",1,!1,5e-4),s("LinearFalloff"),s("Damping",1,!1,1e-5)),r.push(...hi(e,ao));else{for(let[o,a,c]of[["HeightAbove",1],["HeightBelow",1],["Alpha",1],["Color",3],["LifeSpan",1],["TextureSlot",1,!0],["EmissionRate",1,!0],["Rows",1,!0],["Columns",1,!0],["MaterialID",1,!0],["Gravity",1]])s(o,a,c);r.push(...hi(e,lo))}return li(r)}function lu(t){let e=t.readUInt32LE(0)>>>24,n=e===1||e===2,i={Variant:e,Name:dn(t,4,80),Position:Qt(t,84),FieldOfView:t.readFloatLE(96),FarClip:t.readFloatLE(100),NearClip:t.readFloatLE(104),TargetPosition:Qt(t,n?120:108)};return n&&(i.VariantData=new Uint8Array(t.subarray(108,120))),ci(t,n?132:120,i,co),i}function io(t){let e=t.Variant||0,n=li([fn(t.Name,80),Jt(t.Position),tt(t.FieldOfView),tt(t.FarClip),tt(t.NearClip),...[1,2].includes(e)?[q.from(t.VariantData||new Uint8Array(12))]:[],Jt(t.TargetPosition),...hi(t,co)]);if(n.length>16777215)throw new Error("Camera exceeds its 24-bit size field.");return n.writeUInt32LE((n.length|e<<24)>>>0),n}function po(t){let e=q.from(t),n=et(e),i=n.version;if(n.chunks.some(c=>c.tag==="SNEM"))throw new Error("Sound-emitter nodes are not supported; preserving the original file is required to retain their node and pivot references");if(n.chunks.filter(c=>c.tag==="VERS").length>1)throw new Error("Repeated version chunks cannot be edited safely");let r=new Map,s=[q.from("MDLX"),nt("VERS",re(i))];for(let c of n.chunks){let h=e.subarray(c.payloadOffset,c.payloadOffset+c.declaredSize);if(c.tag!=="VERS"){if(r.has(c.tag))throw new Error(`Duplicate ${c.tag} chunks cannot be edited safely.`);if(r.set(c.tag,h),["MTLS","LITE","RIBB","CAMS","CLID"].includes(c.tag)){if(["LITE","RIBB","CLID"].includes(c.tag)){let l=Se(h,c.tag).map(d=>{let u=c.tag==="CLID"?0:4;return d.subarray(u,u+d.readUInt32LE(u))});s.push(nt("HELP",q.concat(l)))}continue}if(c.tag==="GEOS"){let l=Se(h,"GEOS").map(d=>{let u=ir(d,i),f=[];if(i>=1400&&u.SKIN){let m=u.SKIN,x=q.alloc(8+m.count);d.copy(x,0,m.start,m.start+8);for(let g=0;g<m.count;g++)x[8+g]=d.readUInt16LE(m.start+8+g*2)&255;f.push({...m,data:x})}let p=fo(d,f);return p.writeUInt32LE(p.length),p});s.push(nt("GEOS",q.concat(l)));continue}s.push(nt(c.tag,h))}}let o=us(iu(q.concat(s)));r.has("DILG")&&(o.Gliders=Se(r.get("DILG"),"DILG").map(c=>({GeosetId:c.readUInt32LE(0)}))),r.has("MTLS")&&(o.Materials=ru(r.get("MTLS"),i));for(let[c,h]of[["LITE","Lights"],["RIBB","RibbonEmitters"],["CLID","CollisionShapes"]])r.has(c)&&(o[h]=Se(r.get(c),c).map(l=>{let d=c==="CLID"?0:4,u=l.readInt32LE(d+84),f=o.Nodes[u];if(o.Helpers=o.Helpers.filter(x=>x!==f),c!=="CLID")return ou(l,c,i,f);let p=l.readUInt32LE(0);f.Shape=l.readUInt32LE(p),p+=4;let m=f.Shape===2?3:6;return f.Vertices=Qt(l,p,m),p+=m*4,f.Shape>=2&&(f.BoundsRadius=l.readFloatLE(p)),f}));r.has("CAMS")&&(o.Cameras=Se(r.get("CAMS"),"CAMS").map(lu));let a=r.get("MODL");a&&(o.Info.Name=dn(a,0,80),o.Info.AnimationFile=dn(a,80,260));for(let[c,h]of Se(r.get("SEQS")||q.alloc(0),"SEQS").entries())o.Sequences[c].SyncPoint=h.readUInt32LE(100),o.Sequences[c].Flags=h.readUInt32LE(92),o.Sequences[c].NonLooping=!!(o.Sequences[c].Flags&1);for(let[c,h]of Se(r.get("TEXS")||q.alloc(0),"TEXS").entries())o.Textures[c].Image=dn(h,4,260);for(let[c,h,l]of[["ATCH","Attachments",0],["PREM","ParticleEmitters",16]])for(let[d,u]of Se(r.get(c)||q.alloc(0),c).entries())o[h][d].Path=dn(u,4+u.readUInt32LE(4)+l,260);for(let c of o.EventObjects)c.EventTrack=Int32Array.from(c.EventTrack);for(let[c,h]of Se(r.get("GEOS")||q.alloc(0),"GEOS").entries()){let l=o.Geosets[c],d=ir(h,i);l.PrimitiveTypes=Uint32Array.from({length:d.PTYP.count},(u,f)=>h.readUInt32LE(d.PTYP.start+8+f*4)),l.PrimitiveCounts=Uint32Array.from({length:d.PCNT.count},(u,f)=>h.readUInt32LE(d.PCNT.start+8+f*4)),l.SelectionFlags=h.readUInt32LE(d.selection),l.Unselectable=!!(l.SelectionFlags&4),i>=1400&&d.SKIN&&(l.SkinWeights=Uint16Array.from({length:d.SKIN.count},(u,f)=>h.readUInt16LE(d.SKIN.start+8+f*2)))}for(let[c,h]of Se(r.get("GEOA")||q.alloc(0),"GEOA").entries()){let l=o.GeosetAnims[c];l.Alpha?.Keys&&((l._MdxDefaults||={}).Alpha=h.readFloatLE(4)),l.Color?.Keys&&((l._MdxDefaults||={}).Color=Qt(h,12))}for(let[c,{key:h,fields:l}]of Object.entries(nr))for(let[d,u]of Se(r.get(c)||q.alloc(0),c).entries()){let f=o[h][d],p=4+u.readUInt32LE(4);for(let[m,x,g]of l){let y=g===3?Qt(u,p+x):u.readFloatLE(p+x);f[m]?.Keys?(f._MdxDefaults||={})[m]=y:c==="PRE2"&&(m==="Length"||m==="Width")&&(f[m]=y)}}return o}function ui(t){let e={...t};for(let a of["Attachments","Lights","ParticleEmitters","ParticleEmitters2","RibbonEmitters","ParticleEmitterPopcorns","Cameras"])e[a]=(e[a]||[]).map(c=>{if(typeof c.Visibility!="number")return c;let h=[...new Set([0,...(e.Sequences||[]).flatMap(l=>Array.from(l.Interval))])].sort((l,d)=>l-d);return{...c,Visibility:{LineType:0,GlobalSeqId:null,Keys:h.map(l=>({Frame:l,Vector:Float32Array.of(c.Visibility)}))}}});let n={...e,Materials:[],Lights:e.Lights.map(a=>({...a,AttenuationStart:0,AttenuationEnd:0})),RibbonEmitters:e.RibbonEmitters.map(a=>({...a,Color:new Float32Array([1,1,1])})),Cameras:[],CollisionShapes:e.CollisionShapes.map(a=>({...a,Shape:0,Vertices:new Float32Array(6)})),BindPoses:e.BindPoses?.length?e.BindPoses:void 0},i=q.from(eo(n)),r=et(i),s=[q.from("MDLX")];if(r.hasErrors)throw new Error("Invalid generated MDX structure.");let o=new Set;for(let a of r.chunks){let c=q.from(i.subarray(a.payloadOffset,a.payloadOffset+a.declaredSize));if(o.add(a.tag),a.tag==="MODL"&&(fn(e.Info.Name,80).copy(c,0),fn(e.Info.AnimationFile,260).copy(c,80)),a.tag==="SEQS"&&e.Sequences.forEach((h,l)=>{c.writeUInt32LE(h.SyncPoint||0,l*132+100),c.writeUInt32LE(((h.Flags||0)&-2|(h.NonLooping?1:0))>>>0,l*132+92)}),a.tag==="TEXS"&&e.Textures.forEach((h,l)=>fn(h.Image,260).copy(c,l*268+4)),a.tag==="CAMS"&&(c=q.concat(e.Cameras.map(io))),["LITE","RIBB","CLID","ATCH","PREM","PRE2","CORN","GEOS","GEOA"].includes(a.tag)){let h={LITE:"Lights",RIBB:"RibbonEmitters",CLID:"CollisionShapes",ATCH:"Attachments",PREM:"ParticleEmitters",PRE2:"ParticleEmitters2",CORN:"ParticleEmitterPopcorns",GEOS:"Geosets",GEOA:"GeosetAnims"}[a.tag];c=q.concat(Se(c,a.tag).map((l,d)=>{let u=e[h][d];if(nr[a.tag]){let x=4+l.readUInt32LE(4);a.tag==="PRE2"&&(l.writeFloatLE(Be(u,"Length"),x+24),l.writeFloatLE(Be(u,"Width"),x+28));for(let[g,y,v]of nr[a.tag].fields)if(u[g]?.Keys&&u._MdxDefaults?.[g]!=null){let b=u._MdxDefaults[g];v===3?Jt(b).copy(l,x+y):l.writeFloatLE(b,x+y)}if(a.tag!=="PREM")return l}if(a.tag==="LITE"||a.tag==="RIBB")return au(l,u,a.tag,e.Version);if(a.tag==="CLID")return q.concat([l.subarray(0,l.readUInt32LE(0)),re(u.Shape),Jt(u.Vertices),...u.Shape>=2?[tt(u.BoundsRadius)]:[]]);if(a.tag==="ATCH"||a.tag==="PREM")return fn(u.Path,260).copy(l,4+l.readUInt32LE(4)+(a.tag==="PREM"?16:0)),l;if(a.tag==="GEOA")return u.Alpha?.Keys&&l.writeFloatLE(Be(u,"Alpha",1),4),u.Color?.Keys&&Jt(Be(u,"Color",[1,1,1])).copy(l,12),l;let f=ir(l,Math.min(e.Version,1100)),p=[];if(l.writeUInt32LE(((u.SelectionFlags||0)&-5|(u.Unselectable?4:0))>>>0,f.selection),u.PrimitiveCounts&&Array.from(u.PrimitiveCounts).reduce((x,g)=>x+g,0)===u.Faces.length)for(let[x,g]of[["PTYP",u.PrimitiveTypes],["PCNT",u.PrimitiveCounts]])p.push({...f[x],data:q.concat([q.from(x),re(g.length),...Array.from(g,re)])});if(e.Version>=1400&&f.SKIN){let x=q.alloc(8+u.SkinWeights.length*2);x.write("SKIN"),x.writeUInt32LE(u.SkinWeights.length,4),u.SkinWeights.forEach((g,y)=>x.writeUInt16LE(g,8+y*2)),p.push({...f.SKIN,data:x})}let m=fo(l,p);return m.writeUInt32LE(m.length),m}))}s.push(nt(a.tag,c))}return e.Materials.length&&s.push(nt("MTLS",su(e.Materials,e.Version))),!o.has("CAMS")&&e.Cameras.length&&s.push(nt("CAMS",q.concat(e.Cameras.map(io)))),e.Gliders?.length&&s.push(nt("DILG",q.concat(e.Gliders.map(a=>re(a.GeosetId))))),q.concat(s)}import{Buffer as tn}from"buffer";import{Buffer as en}from"buffer";var mo=t=>t===32||t===9||t===10||t===13||t===12,pn=t=>t>=48&&t<=57,vo=t=>t>=65&&t<=90||t>=97&&t<=122||t===95||t===36,cu=t=>vo(t)||pn(t)||t===46,hu=(t,e)=>{let n=t[e];return pn(n)?!0:n===46?pn(t[e+1]):n===43||n===45?pn(t[e+1])||t[e+1]===46&&pn(t[e+2]):!1};function uu(t){if(typeof t=="string")return en.from(t,"utf8");if(en.isBuffer(t))return en.from(t);if(t instanceof Uint8Array)return en.from(t.buffer,t.byteOffset,t.byteLength);throw new TypeError("Expected a string, Buffer, or Uint8Array")}function Ft(t,e,n,i){return Object.freeze({kind:t,start:n,end:i,raw:en.from(e.subarray(n,i))})}function fu(t){return t.kind==="whitespace"||t.kind==="line-comment"||t.kind==="block-comment"}function sr(t,e){let n=t.indexOf(34,e+1);return n<0?-1:n+1}function go(t){return t.raw.toString("ascii")}var rr=class{#e;constructor(e,n,i,r){this.#e=e,this.tokens=n,this.diagnostics=i,this.version=r}get hasErrors(){return this.diagnostics.some(e=>e.severity==="error")}toBytes(){return en.from(this.#e)}summary(){let e={};for(let n of this.tokens)e[n.kind]=(e[n.kind]??0)+1;return{format:"mdl",byteLength:this.#e.length,version:this.version,supportedVersion:xt.includes(this.version),tokenCount:this.tokens.length,tokenKinds:e,diagnostics:this.diagnostics}}};function Xe(t){let e=uu(t),n=[],i=[],r=0;for(;r<e.length;){let a=r,c=e[r];if(mo(c)){for(r+=1;r<e.length&&mo(e[r]);)r+=1;i.push(Ft("whitespace",e,a,r));continue}if(c===47&&e[r+1]===47){for(r+=2;r<e.length&&e[r]!==10&&e[r]!==13;)r+=1;i.push(Ft("line-comment",e,a,r));continue}if(c===34){let h=sr(e,r),l=h>=0;r=l?h:e.length,i.push(Ft("string",e,a,r)),l||n.push(Ge("error","MDL_UNTERMINATED_STRING","String reaches end of file without a closing quote.",a));continue}if(c===47&&e[r+1]===42){let h=e.indexOf(en.from("*/"),r+2);r=h<0?e.length:h+2,i.push(Ft("block-comment",e,a,r)),h<0&&n.push(Ge("error","MDL_UNTERMINATED_BLOCK_COMMENT","Block comment reaches end of file without a closing */.",a));continue}if(vo(c)){for(r+=1;r<e.length&&cu(e[r]);)r+=1;i.push(Ft("identifier",e,a,r));continue}if(hu(e,r)){for(r+=1;r<e.length;){let h=e[r];if(pn(h)||h===46||h===101||h===69||h===43||h===45)r+=1;else break}i.push(Ft("number",e,a,r));continue}if(c===123||c===125||c===44||c===58){r+=1,i.push(Ft("symbol",e,a,r));continue}r+=1,i.push(Ft("other",e,a,r))}let s=i.filter(a=>!fu(a)),o=null;for(let a=0;a<s.length-1;a+=1)if(s[a].kind==="identifier"&&go(s[a])==="FormatVersion"){let c=s[a+1];if(c.kind==="number"){let h=Number.parseInt(go(c),10);Number.isFinite(h)&&(o=h)}break}return o===null?n.push(Ge("warning","MDL_MISSING_VERSION","No FormatVersion value was found.",0)):xt.includes(o)||n.push(Ge("warning","MDL_UNSUPPORTED_VERSION",`Format version ${o} is retained but has no semantic decoder yet.`,0,{version:o,supportedVersions:xt})),new rr(e,i,n,o)}var du=new Set(["whitespace","line-comment","block-comment"]),he=t=>t?.raw.toString("utf8"),bo=t=>/^(?:[+-]?(?:\d|\.)|[+-]?(?:nan|inf(?:inity)?)$)/i.test(he(t)||""),vn=t=>/^[-+]?nan$/i.test(he(t))?NaN:/^[+]?inf(?:inity)?$/i.test(he(t))?1/0:/^-inf(?:inity)?$/i.test(he(t))?-1/0:Number(he(t)),pi=t=>Number.isNaN(t)?"nan":t===1/0?"inf":t===-1/0?"-inf":Object.is(t,-0)?"-0":String(t);function nn(t){let e=tn.from(t),n=Xe(e).tokens.filter(s=>!du.has(s.kind));for(let s=n.length-2;s>=0;s--)he(n[s])==="-"&&/^inf(?:inity)?$/i.test(he(n[s+1]))&&n.splice(s,2,{...n[s],end:n[s+1].end,raw:tn.from("-inf")});let i=0;function r(s=!1){let o=[];for(;i<n.length&&(!s||he(n[i])!=="}");){if(he(n[i])===","){i++;continue}let a=i,c=[];for(;i<n.length&&!["{","}",","].includes(he(n[i]));)c.push(n[i++]);let h=null,l=null,d=null;if(he(n[i])==="{"){if(l=n[i++],h=r(!0),d=n[i++],he(d)!=="}")throw new Error("Unterminated MDL member.")}else if(he(n[i])==="}"&&i===a)break;if(he(n[i])===","&&i++,i===a)throw new Error("Invalid MDL member.");let u=he(c[0])==="static",f=he(c[u?1:0])||"";o.push({name:f,isStatic:u,header:c,children:h,open:l,close:d,start:n[a].start,end:n[i-1].end,tokens:n.slice(a,i)})}return o}return{bytes:e,members:r()}}var pu=t=>t.tokens.filter(e=>bo(e)),yt=t=>pu(t).map(vn);function mn(t,e=!1,n=!1){if(!t.children){let o=t.header.find(a=>a.kind==="string");return o?he(o).slice(1,-1):vn(t.header[t.isStatic?2:1])}let i=t.children.find(o=>["DontInterp","Linear","Hermite","Bezier"].includes(o.name)),r=e?Int32Array:Float32Array;if(!i){let o=r.from(yt({...t,tokens:t.tokens.filter(a=>a.start>t.open.start)}));return n?o.reverse():o}let s={LineType:["DontInterp","Linear","Hermite","Bezier"].indexOf(i.name),GlobalSeqId:null,Keys:[]};for(let o of t.children)if(o.name==="GlobalSeqId")s.GlobalSeqId=mn(o);else if(o.header.some(a=>he(a)===":")){let a=o.header.find(l=>he(l)===":"),c=yt({...o,tokens:o.tokens.filter(l=>l.start>(o.open?.start??a.start))}),h=r.from(c);s.Keys.push({Frame:vn(o.header[0]),Vector:n?h.reverse():h})}else if(["InTan","OutTan"].includes(o.name)&&s.Keys.length){let a=r.from(yt(o));s.Keys.at(-1)[o.name]=n?a.reverse():a}return s}function So(t,e){let n=[],i=0;for(let r of e.sort((s,o)=>s.start-o.start||o.end-s.end))r.start<i||(n.push(t.subarray(i,r.start),tn.from(r.text)),i=r.end);return n.push(t.subarray(i)),tn.concat(n)}var mu={Model:"Info",Sequences:"Sequences",GlobalSequences:"GlobalSequences",Textures:"Textures",Materials:"Materials",TextureAnims:"TextureAnims",Geoset:"Geosets",GeosetAnim:"GeosetAnims",Bone:"Bones",Helper:"Helpers",Light:"Lights",Attachment:"Attachments",EventObject:"EventObjects",CollisionShape:"CollisionShapes",ParticleEmitter:"ParticleEmitters",ParticleEmitter2:"ParticleEmitters2",RibbonEmitter:"RibbonEmitters",ParticleEmitterPopcorn:"ParticleEmitterPopcorns",Camera:"Cameras",PivotPoints:"PivotPoints",FaceFX:"FaceFX",BindPose:"BindPoses"},xo={Sequences:"Anim",Textures:"Bitmap",Materials:"Material",TextureAnims:"TVertexAnim"};function Mo(t,e,n){let i={};for(let r of t){let s=mu[r.name];if(s){if(xo[r.name])(r.children||[]).filter(o=>o.name===xo[r.name]).forEach((o,a)=>Nn(o,e[s]?.[a],n));else if(["Model","PivotPoints"].includes(r.name))Nn(r,e[s],n);else if(r.name!=="GlobalSequences"){let o=i[s]||0;i[s]=o+1,Nn(r,e[s]?.[o],n)}}}}function Nn(t,e,n){if(e){if(n(t,e),t.name==="Material"&&(t.children||[]).filter(i=>i.name==="Layer").forEach((i,r)=>Nn(i,e.Layers?.[r],n)),t.name==="Geoset"&&(t.children||[]).filter(i=>i.name==="Anim").forEach((i,r)=>Nn(i,e.Anims?.[r],n)),t.name==="ParticleEmitter")for(let i of t.children||[])i.name==="Particle"&&n(i,e);if(t.name==="Camera")for(let i of t.children||[])i.name==="Target"&&n(i,{Position:e.TargetPosition,Translation:e.TargetTranslation})}}var fi={WrapWidth:4,WrapHeight:8,Unlit:256,BackFacesForShadows:512,AmbientOcclusion:1024},di={SortPrimsNearZ:8,TwoSided:2},Bn={DontInheritTranslation:1,DontInheritRotation:2,DontInheritScaling:4,Billboarded:8,BillboardedLockX:16,BillboardedLockY:32,BillboardedLockZ:64,CameraAnchored:128},yo={shader_sd_legacy:0,shader_hd_defaultunit:1,shader_sd_fixedfunction:2,shader_hd_crystal:24},ar=new Set(["SyncPoint","SelectionFlags","ShadowIntensity","ShadowCasting","ShadowCastingStart","ShadowCastingEnd","QuadraticFalloff","LinearFalloff","Damping"]),or={DOFDistance:"FocusDistance",FocusDistanceKeys:"FocusDistance",FocalLength:"FocalLength",FocalLengthKeys:"FocalLength",FStop:"FStop",FStopKeys:"FStop"},gu={ShadowIntensity:1200,ShadowCasting:1300,ShadowCastingStart:1300,ShadowCastingEnd:1300,QuadraticFalloff:1600,LinearFalloff:1600,Damping:1600};function To(t){let e=nn(t),n=[];function i(r,s){let o=()=>n.push({start:r.start,end:r.end,text:""});if(r.name==="Glider"){o();return}if(r.name==="Visibility"&&r.isStatic&&!r.children){o();return}if(s==="ParticleEmitter"&&["Path","LifeSpan","InitVelocity"].includes(r.name)){n.push({start:r.start,end:r.end,text:`Particle { ${e.bytes.subarray(r.start,r.end).toString("utf8")} }`});return}if(r.name==="DontInherit"){o();return}if(r.name in Bn&&r.name.startsWith("DontInherit")){o();return}if(r.name==="SortPrimitives"&&n.push({start:r.header[0].start,end:r.header[0].end,text:"SortPrimsFarZ"}),r.name==="LevelOfDetailName"&&n.push({start:r.header[0].start,end:r.header[0].end,text:"Name"}),(r.name==="EmitterUsesMdl"||r.name==="EmitterUsesTga")&&n.push({start:r.header[0].start,end:r.header[0].end,text:r.name==="EmitterUsesMdl"?"EmitterUsesMDL":"EmitterUsesTGA"}),ar.has(r.name)||s==="Layer"&&r.name in fi||s==="Material"&&(r.name in di||r.name==="Unfogged")||r.name==="PopcornScaling"){o();return}if(s==="Layer"&&r.name==="Shader"){let a=mn(r).toLowerCase();if(!(a in yo))throw new Error(`Unknown layer shader ${a}.`);n.push({start:r.start,end:r.end,text:`ShaderTypeId ${yo[a]},`});return}if(s==="RibbonEmitter"&&r.name==="Color"&&!r.isStatic&&r.children?.some(a=>["DontInterp","Linear","Hermite","Bezier"].includes(a.name))){o();return}if(s==="Camera"&&(r.name==="Visibility"||r.name in or)){o();return}if((r.name==="Plane"||r.name==="Cylinder")&&n.push({start:r.start,end:r.end,text:"Box,"}),r.name==="SkinWeights"&&r.children){let a=yt({...r,tokens:r.tokens.filter(h=>h.start>r.open.start)}),c=[];if(a.length%8)throw new Error("SkinWeights requires eight values per vertex.");for(let h=0;h<a.length;h+=8)c.push(`{ ${a.slice(h,h+8).map(l=>l&255).join(", ")} },`);n.push({start:r.open.end,end:r.close.start,text:c.join(`
`)});return}if(r.name==="TextureID"){let a=r.tokens.findIndex(c=>he(c)==="<");if(a>=0){let c=vn(r.tokens[a+2]),h=Lt[c];if(!h)throw new Error(`Unsupported texture slot ${c}.`);let l=r.header[r.isStatic?1:0];n.push({start:l.start,end:l.end,text:h}),n.push({start:r.tokens[a].start,end:r.tokens[a+2].end,text:""})}}for(let a of r.children||[])i(a,r.name)}for(let r of e.members)i(r,null);for(let r of Xe(e.bytes).tokens)(r.kind==="line-comment"||r.kind==="block-comment")&&n.push({start:r.start,end:r.end,text:" "});for(let r of Xe(e.bytes).tokens)r.kind!=="string"&&/^[-+]?(?:nan|inf(?:inity)?)$/i.test(he(r))&&n.push({start:r.start,end:r.end,text:"0"});return{text:So(e.bytes,n).toString("utf8"),restore(r){vu(e.members,r)}}}function vu(t,e){e.Gliders=t.filter(n=>n.name==="Glider").map(n=>({GeosetId:mn(n.children.find(i=>i.name==="GeosetId"))})),Mo(t,e,(n,i)=>{if(n.name==="PivotPoints")return;if(n.name==="Anim"&&!n.header.some(s=>s.kind==="string"))for(let s of["Alpha","Color","Flags","GeosetId"])n.children.some(o=>o.name===s)||delete i[s];n.name==="ParticleEmitterPopcorn"&&(i.Flags&=-393217);let r=0;for(let s of n.children||[]){let o=s.name==="LevelOfDetailName"?"Name":s.name;if(!["FilterMode","Shape","LightType","Groups"].includes(o)){if(o==="Faces"&&n.name==="Geoset"){let a=(s.children||[]).flatMap(c=>(c.children||[]).filter(h=>h.children));i.PrimitiveTypes=Uint32Array.from(a,()=>4),i.PrimitiveCounts=Uint32Array.from(a,c=>yt(c).length);continue}if(o==="TextureID"){let a=s.tokens.findIndex(c=>he(c)==="<");a>=0&&(o=Lt[vn(s.tokens[a+2])])}if(n.name==="Layer"&&o in fi){i.Shading|=fi[o];continue}if(n.name==="Material"&&o in di){i.RenderMode|=di[o];continue}if(n.name==="Material"&&o==="Unfogged"){i.Unfogged=!0;continue}if(n.name==="Light"&&o==="ShadowCasting"){i.ShadowCasting=1;continue}if(n.name==="Camera"&&o in or){let a=mn(s);i[or[o]]=typeof a=="number"?{LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:Float32Array.of(a)}]}:a;continue}if("ObjectId"in i&&o in Bn){i.Flags|=Bn[o],delete i[o];continue}if(o==="DontInherit"){for(let a of s.children||[])i.Flags|=Bn["DontInherit"+a.name]||0;continue}if(n.name==="ParticleEmitterPopcorn"&&o==="Unfogged"){i.Flags|=131072;continue}if(n.name==="ParticleEmitterPopcorn"&&o==="PopcornScaling"){i.Flags|=262144;continue}if(o==="Plane"||o==="Cylinder"){i.Shape=o==="Plane"?1:3;continue}if(o==="SkinWeights"){i.SkinWeights=(e.Version>=1400?Uint16Array:Uint8Array).from(yt({...s,tokens:s.tokens.filter(a=>a.start>s.open.start)}));continue}if(["Interval","LifeSpanUVAnim","DecayUVAnim","TailUVAnim","TailDecayUVAnim"].includes(o)){i[o]=Uint32Array.from(yt(s));continue}if(o==="TVertices"){i.TVertices[r++]=mn(s);continue}if(["Vertices","Normals","Tangents","VertexGroup","EventTrack"].includes(o)){let a=o==="EventTrack"?Int32Array:o==="VertexGroup"?Uint8Array:Float32Array;i[o]=a.from(yt({...s,tokens:s.tokens.filter(c=>c.start>s.open.start)}));continue}if(ar.has(o)||o in i&&(typeof i[o]=="number"||typeof i[o]=="string"||ArrayBuffer.isView(i[o])||i[o]?.Keys)||o==="Visibility"&&"ObjectId"in i||["Color","Visibility"].includes(o)&&["RibbonEmitter","Camera"].includes(n.name)){if(["ObjectId","Parent"].includes(o)||!s.header[1]&&!s.children)continue;let a=["Color","AmbColor"].includes(o)&&n.name!=="ParticleEmitterPopcorn",c=i[o],h=mn(s,Lt.includes(o)||o==="TextureSlot",a);h?.Keys&&c!=null&&!c.Keys&&(n.children||[]).some(l=>l!==s&&l.name===s.name&&l.isStatic)&&((i._MdxDefaults||={})[o]=c),i[o]=h}}}n.name==="Geoset"&&i.SelectionFlags!=null&&(i.Unselectable=!!(i.SelectionFlags&4))});for(let n of e.EventObjects||[])n.EventTrack=Int32Array.from(n.EventTrack)}var gn=(t,e=!1)=>`{ ${Array.from(t,pi)[e?"reverse":"slice"]().join(", ")} }`,_o=(t,e)=>t.length===1?pi(t[0]):gn(t,e);function qe(t,e,n=!1,i=!1){if(e?.Keys){let r=[["DontInterp","Linear","Hermite","Bezier"][e.LineType]+","];e.GlobalSeqId!=null&&r.push(`GlobalSeqId ${e.GlobalSeqId},`);for(let s of e.Keys)if(r.push(`${s.Frame}: ${_o(s.Vector,n)},`),e.LineType>=2)for(let o of["InTan","OutTan"])r.push(`${o} ${_o(s[o],n)},`);return`${t} ${e.Keys.length} {
${r.join(`
`)}
}`}return`${i?"static ":""}${t} ${typeof e=="string"?`"${e}"`:typeof e=="number"?pi(e):gn(e,n)},`}function Ao(t,e){let n=nn(t),i=[];Mo(n.members,e,(s,o)=>{let a=[],c=0;if(s.name==="PivotPoints"){i.push({start:s.open.end,end:s.close.start,text:`
`+o.map(l=>gn(l)+",").join(`
`)+`
`});return}if(s.name==="BindPose"){let l=s.children.find(d=>d.name==="Matrices");l&&i.push({start:l.open.end,end:l.close.start,text:`
`+o.Matrices.map(d=>gn(d)+",").join(`
`)+`
`});return}let h=new Set;for(let l of s.children||[]){let d=l.name;h.add(d);let u=o[d];if(s.name==="Material"&&d==="SortPrimsFarZ"){i.push({start:l.start,end:l.end,text:"SortPrimitives,"});continue}if(d==="Faces"&&o.PrimitiveCounts&&Array.from(o.PrimitiveCounts).reduce((f,p)=>f+p,0)===o.Faces.length){let f=0,p=Array.from(o.PrimitiveCounts,m=>{let x=gn(o.Faces.subarray(f,f+m));return f+=m,x+","});i.push({start:l.start,end:l.end,text:`Faces ${p.length} ${o.Faces.length} { Triangles { ${p.join(`
`)} } }`});continue}if(d==="TVertices"&&(u=o.TVertices[c++]),d==="SegmentColor"&&o.SegmentColor){i.push({start:l.open.end,end:l.close.start,text:o.SegmentColor.map(f=>qe("Color",f,!0)).join(`
`)});continue}if(d==="TVertices"&&!u){i.push({start:l.start,end:l.end,text:""});continue}if(d==="DontInherit"){i.push({start:l.start,end:l.end,text:(l.children||[]).map(f=>`DontInherit { ${f.name} },`).join(`
`)});continue}if(["Vertices","Normals","Tangents","TVertices","VertexGroup","EventTrack","SkinWeights"].includes(d)&&ArrayBuffer.isView(u)){let f={Vertices:3,Normals:3,Tangents:4,TVertices:2,VertexGroup:1,EventTrack:1,SkinWeights:8}[d],p=[];for(let m=0;m<u.length;m+=f)p.push(f===1?pi(u[m])+",":gn(u.subarray(m,m+f))+",");i.push({start:l.open.end,end:l.close.start,text:`
`+p.join(`
`)+`
`});continue}if(!(u==null||typeof u=="boolean"||["ObjectId","Parent","Flags","Shape","LightType","FilterMode","RenderMode","Shading","Rows","Columns","Faces","Groups"].includes(d))&&(typeof u=="number"||typeof u=="string"||ArrayBuffer.isView(u)||u.Keys)){let f=["Color","AmbColor"].includes(d)&&s.name!=="ParticleEmitterPopcorn",p=o._MdxDefaults?.[d],m=u.Keys&&p!=null?qe(d,p,f,!0)+`
`:"";i.push({start:l.start,end:l.end,text:m+qe(s.name==="Geoset"&&d==="Name"?"LevelOfDetailName":d,u,f,l.isStatic)})}}for(let l of ar)if(o[l]!=null&&!h.has(l)&&l!=="ShadowCasting"&&e.Version>=(gu[l]||0)){let d=l==="SelectionFlags"?(o.SelectionFlags&-5|(o.Unselectable?4:0))>>>0:o[l];a.push(qe(l,d,!1,d?.Keys?!1:["ShadowIntensity","ShadowCastingStart","ShadowCastingEnd","QuadraticFalloff","LinearFalloff","Damping"].includes(l)))}if(s.name==="Light"&&o.ShadowCasting&&e.Version>=1300&&a.push("ShadowCasting,"),s.name==="Camera")for(let l of["FocusDistance","FocalLength","FStop"])o[l]&&a.push(qe(l+"Keys",o[l]));if(s.name==="Layer")for(let[l,d]of Object.entries(fi))o.Shading&d&&a.push(l+",");if(s.name==="Material")for(let[l,d]of Object.entries(di))o.RenderMode&d&&a.push(l+",");if(s.name==="Material"&&o.Unfogged&&a.push("Unfogged,"),"ObjectId"in o)for(let[l,d]of Object.entries(Bn))o.Flags&d&&!h.has(l)&&!l.startsWith("DontInherit")&&a.push(l+",");if(s.name==="ParticleEmitterPopcorn"){for(let l of s.children||[])l.name==="Unfogged"&&i.push({start:l.start,end:l.end,text:""});o.Flags&131072&&a.push("Unfogged,"),o.Flags&262144&&a.push("PopcornScaling,");for(let l of["LifeSpan","EmissionRate","Speed","Alpha"])o[l]!=null&&!h.has(l)&&a.push(qe(l,o[l],!1,!0))}if(s.name==="CollisionShape"&&[1,3].includes(o.Shape)){let l=s.children.find(d=>["Box","Sphere"].includes(d.name));l&&i.push({start:l.start,end:l.end,text:o.Shape===1?"Plane,":"Cylinder,"}),o.Shape===3&&!h.has("BoundsRadius")&&a.push(qe("BoundsRadius",o.BoundsRadius))}for(let l of["Color","Visibility"])o[l]?.Keys&&!h.has(l)&&a.push(qe(l,o[l],l==="Color"));if(typeof o.Visibility=="number"&&!h.has("Visibility")&&a.push(qe("Visibility",o.Visibility,!1,!0)),s.name==="GeosetAnim"&&o.Flags&2&&!h.has("Color")&&o.Color&&a.push(qe("Color",o.Color,!0,!0)),s.name==="Light")for(let l of["Color","AmbColor"])o[l]&&!h.has(l)&&a.push(qe(l,o[l],!0,!0));for(let l of["BoundsRadius","MinimumExtent","MaximumExtent"])o[l]!=null&&!h.has(l)&&a.push(qe(l,o[l]));a.length&&i.push({start:s.close.start,end:s.close.start,text:`
`+a.join(`
`)+`
`})});let r=(e.Gliders||[]).map(s=>`
Glider { GeosetId ${s.GeosetId}, }
`).join("");return tn.concat([So(n.bytes,i),tn.from(r)])}function Eo(t){let{bytes:e,members:n}=nn(t);function i(r,s){let o="	".repeat(s);if(!r.children)return o+e.subarray(r.start,r.end).toString("utf8").trim();let a=e.subarray(r.start,r.open.start).toString("utf8").trim(),c=e.subarray(r.close.end,r.end).toString("utf8").trim(),h=r.name==="DontInherit"||!["VertexGroup","EventTrack","GlobalSequences"].includes(r.name)&&r.children.length>0&&r.children.every(d=>!d.children&&d.header.every(bo)),l=a?a+" ":"";return h?o+l+"{ "+r.children.map(d=>i(d,0)).join(" ")+" }"+c:o+l+`{
`+r.children.map(d=>i(d,s+1)).join(`
`)+(r.children.length?`
`:"")+o+"}"+c}return tn.from(n.map(r=>i(r,0)).join(`
`)+`
`)}function wo(t){let e=nn(t).members[0],n=yt({...e,tokens:e.tokens.filter(r=>r.start>e.open.start)}),i=vn(e.header[1]);if(n.length!==i*3)throw new Error("PivotPoints count does not match its coordinates.");return Array.from({length:i},(r,s)=>Float32Array.from(n.slice(s*3,s*3+3)))}var mi=Object.freeze(["Bones","Lights","Helpers","Attachments","ParticleEmitters","ParticleEmitters2","ParticleEmitterPopcorns","RibbonEmitters","EventObjects","CollisionShapes"]),lr=t=>mi.flatMap(e=>t[e]||[]);function Po(t,{preserveUnusedPivots:e=!1}={}){let n=lr(t),i=new Set;for(let l of n){if(!Number.isInteger(l?.ObjectId)||l.ObjectId<0||i.has(l.ObjectId))throw Error("The model has invalid or duplicate node object IDs.");i.add(l.ObjectId)}let r=new Map(n.map((l,d)=>[l.ObjectId,d])),s=n.map(l=>{if(l.Parent==null||l.Parent===-1)return l.Parent;if(!r.has(l.Parent))throw Error(`Node ${l.Name||l.ObjectId} references missing parent ${l.Parent}.`);return r.get(l.Parent)}),o=n.map(l=>{let d=t.PivotPoints?.[l.ObjectId]||l.PivotPoint;if(!d||d.length!==3||Array.from(d).some(u=>!Number.isFinite(u)))throw Error(`Node ${l.Name||l.ObjectId} has an invalid pivot reference.`);return d});e&&t.PivotPoints?.forEach((l,d)=>{i.has(d)||o.push(l)});let a=(t.Geosets||[]).map((l,d)=>(l.Groups||[]).map(u=>u.map(f=>{if(!r.has(f))throw Error(`Geoset ${d} references missing node ${f}.`);return r.get(f)}))),c=(t.Geosets||[]).map((l,d)=>{if(!l.SkinWeights?.length)return null;let u=new l.SkinWeights.constructor(l.SkinWeights),f=t.Version>=1400?65535:255;for(let p=0;p<u.length;p+=8)for(let m=0;m<4;m++){if(!u[p+4+m]){u[p+m]=0;continue}let x=u[p+m],g=r.get(x);if(g==null)throw Error(`Geoset ${d} skin weights reference missing node ${x}.`);if(g>f)throw Error(`Geoset ${d} cannot represent remapped node ${g} in its skin-weight format.`);u[p+m]=g}return u}),h=(t.BindPoses||[]).map((l,d)=>{if(!Array.isArray(l.Matrices))throw Error(`Bind pose ${d} has invalid matrices.`);let u=l.Matrices.length-(t.Cameras?.length||0);return n.map(p=>{let m=l.Matrices[p.ObjectId];if(!m||p.ObjectId>=u)throw Error(`Bind pose ${d} is missing matrix ${p.ObjectId}.`);return m}).concat(l.Matrices.slice(u))});n.forEach((l,d)=>{l.ObjectId=d,l.Parent=s[d],l.PivotPoint=o[d]});for(let l=0;l<(t.Geosets||[]).length;l++)t.Geosets[l].Groups=a[l],t.Geosets[l].TotalGroupsCount=a[l].reduce((d,u)=>d+u.length,0),c[l]&&(t.Geosets[l].SkinWeights=c[l]);return(t.BindPoses||[]).forEach((l,d)=>{l.Matrices=h[d]}),t.PivotPoints=o,t.Nodes=[],n.forEach(l=>{t.Nodes[l.ObjectId]=l}),r}var cr=t=>Array.isArray(t?.Color?.Keys),Co=t=>!!(t?.Flags&2),xu=t=>t==null||(Array.isArray(t)||ArrayBuffer.isView(t))&&t.length===3&&Array.from(t).every(e=>e===1),On=t=>!Co(t)&&!cr(t)&&xu(t?.Color),Ro=(t,e)=>On(t)&&On(e);function Io(t,e){return t.map(n=>On(n)?{...n,Color:e==="mdl"?null:new Float32Array([1,1,1])}:n)}function Lo(t,e){let n=[];for(let[i,r]of t.entries()){let s=`GeosetAnims[${i}].Color`;!cr(r)&&!On(r)&&(!(r.Color instanceof Float32Array)||r.Color.length!==3||!r.Color.every(Number.isFinite))?n.push(`${s}: invalid static color; expected three finite RGB values.`):e==="mdl"&&!Co(r)&&!On(r)&&n.push(`${s}: ${cr(r)?"disabled tint with a color track":"dormant nonwhite color"} cannot be represented in MDL without enabling tint; save as MDX to preserve it.`)}return n}var yu=new Set(["Nodes","PivotPoint","TotalGroupsCount","NumGeosets","NumGeosetAnims","NumBones","NumHelpers","NumLights","NumAttachments","NumEvents","NumParticleEmitters","NumParticleEmitters2","NumRibbonEmitters"]),hr={AnimationFile:"",Path:"",PriorityPlane:0,Gravity:0,SyncPoint:0,Flags:0,SelectionFlags:0,Variant:0,Shader:"",Name:"",LevelOfDetail:0,Alpha:1,EmissiveGain:1,FresnelOpacity:0,FresnelTeamColor:0,ShaderTypeId:0,ShadowIntensity:0,ShadowCasting:0,ShadowCastingStart:0,ShadowCastingEnd:0,QuadraticFalloff:5e-4,LinearFalloff:0,Damping:1e-5,_MdxTextureId:0},ur=(t,e)=>Object.is(t,e)||Object.is(Math.fround(t),Math.fround(e)),_u=new Set(["Version","Frame","Flags","RenderMode","Shading","SelectionFlags","SyncPoint","ObjectId","Parent","GeosetId","GeosetAnimId","MaterialID","TextureID","NormalTextureID","ORMTextureID","EmissiveTextureID","TeamColorTextureID","ReflectionsTextureID","TextureSlot","TVertexAnimId","CoordId","GlobalSeqId","LineType","AttachmentID","ReplaceableId","FilterMode","LightType","Shape","Rows","Columns","PriorityPlane","SelectionGroup","LevelOfDetail","ShaderTypeId","Variant","BlendTime","_MdxTextureId"]);function bu(t,e){return t==null?!0:e in hr?typeof t=="number"?ur(t,hr[e]):t===hr[e]:e==="FresnelColor"?Array.from(t).every(n=>n===1):!1}function Su(t,e,{keys:n=Object.keys(t),limit:i=12}={}){let r=[],s=0,o=c=>{s++,r.length<i&&r.push(c)};function a(c,h,l,d,u=!1){if(!yu.has(d)&&d!=="_MdxSlots"){if(d==="Visibility"&&typeof c=="number"&&h?.Keys&&h.LineType===0&&h.GlobalSeqId==null){let f=h.Keys.length>0&&h.Keys.every(m=>m.Vector.length===1&&ur(c,m.Vector[0])),p=(t.Sequences||[]).every(m=>h.Keys.some(x=>x.Frame>=m.Interval[0]&&x.Frame<=m.Interval[1]));if(f&&p)return}if(c==null||h==null){if(c==null&&h==null||bu(c??h,d))return;o(l);return}if(typeof c=="number"&&typeof h=="number"){(u||_u.has(d)?c!==h:!ur(c,h))&&o(l);return}if(typeof c!="object"||typeof h!="object"){c!==h&&o(l);return}if(ArrayBuffer.isView(c)||Array.isArray(c)){if(c.length!==h.length){o(l+".length");return}let f=ArrayBuffer.isView(c)&&!(c instanceof Float32Array)&&!(c instanceof Float64Array);for(let p=0;p<c.length;p++)a(c[p],h[p],`${l}[${p}]`,String(p),f);return}for(let f of new Set([...Object.keys(c),...Object.keys(h)]))if(!(f==="Color"&&/^GeosetAnims\[\d+\]$/.test(l)&&Ro(c,h))&&!(f==="BoundsRadius"&&"Shape"in c&&c.Shape<2)){if(f==="Flags"&&"NonLooping"in c){a((c.Flags||0)&-2,(h.Flags||0)&-2,l+".Flags",f);continue}if(f==="SelectionFlags"){a((c[f]||0)&-5,(h[f]||0)&-5,l+"."+f,f);continue}if((f==="PrimitiveTypes"||f==="PrimitiveCounts")&&(!c[f]||!h[f])){let p=c.PrimitiveTypes||h.PrimitiveTypes,m=c.PrimitiveCounts||h.PrimitiveCounts;if(p?.length===1&&p[0]===4&&m?.length===1&&m[0]===(c.Faces||h.Faces)?.length)continue}if(f==="_MdxDefaults"){for(let p of Object.keys(c[f]||{}))a(c[f][p],h[f]?.[p],`${l}.${f}.${p}`,p);continue}a(c[f],h[f],`${l}.${f}`,f)}}}for(let c of n)a(t[c],e[c],c,c);return{total:s,differences:r}}function gi(t,e,n=12){return`${t} (${e.length} issue${e.length===1?"":"s"}): ${e.slice(0,n).join(" ")}${e.length>n?` ${e.length-n} more.`:""}`}function fr(t,e,n){let{total:i,differences:r}=Su(t,e,n);if(i){let s=performance.now(),o=new Error(`Save verification failed: serialization changed ${i} field${i===1?"":"s"}: ${r.join(", ")}${i>r.length?`; ${i-r.length} more`:""}.`);throw n?.timings&&(n.timings.errorFormattingMs=performance.now()-s),o}}import{Buffer as xn}from"buffer";var Fo=t=>JSON.stringify(t,(e,n)=>e==="PivotPoint"?void 0:ArrayBuffer.isView(n)?Array.from(n):typeof n=="number"&&!Number.isFinite(n)?String(n):n),Mu=new Set(["SEQS","TEXS","MTLS","TXAN","GEOS","GEOA","BONE","HELP","ATCH","LITE","PREM","PRE2","RIBB","CORN","CAMS","CLID","EVTS","PIVT","GLBS"]);function Uo(t,e){let n=new Map;return t.forEach((i,r)=>{let s=Fo(i);n.has(s)||n.set(s,[]),n.get(s).push(r)}),e.map(i=>n.get(Fo(i))?.shift())}function No(t,e,n,i,r){let s=xn.from(t),o=xn.from(e),a=new Map(et(s).chunks.map(h=>[h.tag,h])),c=new Map(Object.entries(r).map(([h,[,l]])=>[l,h]));return xn.concat([xn.from("MDLX"),...et(o).chunks.map(h=>{let l=c.get(h.tag),d=a.get(h.tag),u=o.subarray(h.payloadOffset,h.payloadOffset+h.declaredSize);if(!Mu.has(h.tag)||!d||!Array.isArray(n[l])||!Array.isArray(i[l]))return nt(h.tag,u);let f=Se(s.subarray(d.payloadOffset,d.payloadOffset+d.declaredSize),h.tag),p=Se(u,h.tag),m=Uo(n[l],i[l]);if(f.length!==n[l].length||p.length!==i[l].length)throw new Error(`Cannot match ${h.tag} source records safely.`);return nt(h.tag,xn.concat(p.map((x,g)=>m[g]===void 0?x:f[m[g]])))})])}var Do={Sequences:"Anim",Textures:"Bitmap",Materials:"Material",TextureAnims:"TVertexAnim"};function Bo(t,e,n,i,r){let s=nn(t),o=nn(e),a=[];for(let[l,[d]]of Object.entries(r)){if(!Array.isArray(n[l])||!Array.isArray(i[l])||["PivotPoints","GlobalSequences","BindPoses"].includes(l))continue;let u=x=>x.members.filter(g=>g.name===d).flatMap(g=>Do[d]?(g.children||[]).filter(y=>y.name===Do[d]):[g]),f=u(s),p=u(o),m=Uo(n[l],i[l]);f.length!==n[l].length||p.length!==i[l].length||p.forEach((x,g)=>{if(m[g]!==void 0){let y=f[m[g]];a.push({start:x.start,end:x.end,bytes:s.bytes.subarray(y.start,y.end)})}})}let c=[],h=0;for(let l of a.sort((d,u)=>d.start-u.start))c.push(o.bytes.subarray(h,l.start),l.bytes),h=l.end;return c.push(o.bytes.subarray(h)),xn.concat(c)}var dr=t=>Number.isInteger(t)&&t>=0&&t<=4294967295;function pr(t){let e=s=>s instanceof Uint32Array,n=(s,o)=>Object.keys(s).every(a=>o.includes(a)),i=s=>!!s&&typeof s=="object"&&!Array.isArray(s)&&Object.entries(s).every(([o,a])=>dr(Number(o))&&e(a)),r=s=>!!s&&e(s.selectable)&&i(s.selection)&&i(s.hidden)&&(s.activeGeoset===-1||dr(s.activeGeoset))&&dr(s.uvSet)&&(s.selectedNodeIds===void 0||e(s.selectedNodeIds))&&n(s,["selectable","selection","hidden","activeGeoset","uvSet","selectedNodeIds"]);return t?.version===1&&r(t.before)&&r(t.after)&&n(t,["version","before","after"])}var Oo=Object.freeze({budgetBytes:512*1024*1024,maxSteps:1e4}),_t=t=>structuredClone(t),xi=new Set(["__proto__","prototype","constructor"]),Ie=(t,e)=>Object.prototype.hasOwnProperty.call(t,e);function Vn(t){return t instanceof ArrayBuffer?new Uint8Array(t):new Uint8Array(t.buffer,t.byteOffset,t.byteLength)}function vi(t,e=new Set){return t==null?8:typeof t=="string"?24+t.length*2:typeof t!="object"?16:e.has(t)?8:(e.add(t),ArrayBuffer.isView(t)||t instanceof ArrayBuffer?80+t.byteLength:64+Object.entries(t).reduce((n,[i,r])=>n+16+i.length*2+vi(r,e),0))}function yn(t,e,{ignore:n=()=>!1}={}){let i=[],r=new Set,s=[];function o(l,d,u){if(n(u)||Object.is(l,d))return!0;if(!l||!d||typeof l!="object"||typeof d!="object"||l.constructor!==d.constructor)return!1;if(ArrayBuffer.isView(l)||l instanceof ArrayBuffer){if(l.byteLength!==d.byteLength)return!1;if(mr(l,d))return!0;let p=Vn(l),m=Vn(d);for(let x=0;x<p.length;x++)if(p[x]!==m[x])return!1;return!0}if(Array.isArray(l)&&l.length!==d.length)return!1;let f=Object.keys(l);return f.length===Object.keys(d).length&&f.every(p=>Ie(d,p)&&o(l[p],d[p],[...u,p]))}function a(l,d,u,f){i.push({kind:"value",path:[...s],beforeExists:u,afterExists:f,before:_t(l),after:_t(d)})}function c(l,d,u,f,p){if(xi.has(u))throw new Error(`Unsafe document property: ${u}.`);f===p&&Object.is(l[u],d[u])||(s.push(u),h(l[u],d[u],f,p),s.pop())}function h(l,d,u=!0,f=!0){if(!(n(s)||u===f&&Object.is(l,d))){if(!u||!f||!l||!d||typeof l!="object"||typeof d!="object"||l.constructor!==d.constructor){a(l,d,u,f);return}if(ArrayBuffer.isView(l)||l instanceof ArrayBuffer){if(l.byteLength!==d.byteLength){a(l,d,u,f);return}if(mr(l,d))return;let p=Vn(l),m=Vn(d),x=-1,g=-1,y=()=>{x>=0&&i.push({kind:"bytes",path:[...s],offset:x,before:p.slice(x,g+1),after:m.slice(x,g+1)})};for(let v=0;v<p.length;v++)p[v]!==m[v]?(x<0&&(x=v),g=v):x>=0&&v-g>32&&(y(),x=-1);y();return}if(Array.isArray(l)&&l.length!==d.length){let p=0,m=0;for(;p<Math.min(l.length,d.length)&&o(l[p],d[p],[...s,String(p)]);)p++;for(;m<Math.min(l.length,d.length)-p&&o(l[l.length-m-1],d[d.length-m-1],[...s,String(l.length-m-1)]);)m++;i.push({kind:"splice",path:[...s],index:p,before:_t(l.slice(p,l.length-m)),after:_t(d.slice(p,d.length-m))});return}if(!(s.at(-1)==="Keys"&&Array.isArray(l)&&Tu(l,d))){if(r.has(d))throw new Error("Document history cannot store a cyclic model value.");r.add(d);for(let p in l)Ie(l,p)&&c(l,d,p,!0,Ie(d,p));for(let p in d)Ie(d,p)&&!Ie(l,p)&&c(l,d,p,!1,!0);r.delete(d)}}}for(let l of new Set([...Object.keys(t),...Object.keys(e)])){if(xi.has(l))throw new Error(`Unsafe document property: ${l}.`);s.push(l),h(t[l],e[l],Ie(t,l),Ie(e,l)),s.pop()}return i}function mr(t,e){if(t.length===void 0||t.length!==e.length)return!1;for(let n=0;n<t.length;n++)if(!Object.is(t[n],e[n])||t[n]!==t[n])return!1;return!0}function Tu(t,e){let n=0;for(let i=0;i<t.length;i++){if(Ie(t,i)!==Ie(e,i))return!1;Ie(t,i)&&n++;let r=t[i],s=e[i];if(!Object.is(r,s)){if(!r||!s||typeof r!="object"||typeof s!="object"||r.constructor!==s.constructor)return!1;for(let o in r)if(Ie(r,o)){if(xi.has(o)||!Ie(s,o))return!1;if(Object.is(r[o],s[o]))continue;if(!ArrayBuffer.isView(r[o])||r[o].constructor!==s[o]?.constructor||!mr(r[o],s[o]))return!1}for(let o in s)if(Ie(s,o)&&!Ie(r,o))return!1}}return Object.keys(t).length===n&&Object.keys(e).length===n}function Vo(t){if(!t||!Array.isArray(t.path)||!t.path.length||t.path.length>128||t.path.some(e=>typeof e!="string"||xi.has(e)))throw new Error("Invalid recovery history path.");if(t.kind==="bytes"){if(!Number.isSafeInteger(t.offset)||t.offset<0||!(t.before instanceof Uint8Array)||!(t.after instanceof Uint8Array)||t.before.length!==t.after.length)throw new Error("Invalid recovery history byte range.")}else if(t.kind==="splice"){if(!Number.isSafeInteger(t.index)||t.index<0||!Array.isArray(t.before)||!Array.isArray(t.after))throw new Error("Invalid recovery history array range.")}else if(t.kind!=="value"||typeof t.beforeExists!="boolean"||typeof t.afterExists!="boolean")throw new Error("Invalid recovery history change.")}function _n(t,e,n="after"){if(!["before","after"].includes(n))throw new Error("Invalid history direction.");let i=e.map(r=>{Vo(r);let s=t;for(let a of r.path.slice(0,-1)){if(!s||typeof s!="object"||!Ie(s,a))throw new Error("History no longer matches this document.");s=s[a]}if(!s||typeof s!="object")throw new Error("History no longer matches this document.");let o=r.path.at(-1);if(r.kind==="bytes"){let a=s[o];if(!(ArrayBuffer.isView(a)||a instanceof ArrayBuffer)||r.offset+r[n].length>a.byteLength)throw new Error("History byte range no longer matches this document.");return{bytes:Vn(a),offset:r.offset,value:r[n]}}if(r.kind==="splice"){let a=s[o],c=r[n==="after"?"before":"after"].length;if(!Array.isArray(a)||r.index+c>a.length)throw new Error("History array range no longer matches this document.");return{parent:s,key:o,exists:!0,value:a.slice(0,r.index).concat(_t(r[n]),a.slice(r.index+c))}}return{parent:s,key:o,exists:r[`${n}Exists`],value:_t(r[n])}});for(let r of i)r.bytes?r.bytes.set(r.value,r.offset):r.exists?r.parent[r.key]=r.value:delete r.parent[r.key]}var Gn=class t{constructor(e={}){this.undoEntries=[],this.redoEntries=[],this.usedBytes=0,this.evictedSteps=0,this.lastEntryRetained=!0,this.configure(e)}configure(e={}){let n=e.budgetBytes??this.budgetBytes??Oo.budgetBytes,i=e.maxSteps??this.maxSteps??Oo.maxSteps;if(!Number.isSafeInteger(n)||n<0||!Number.isSafeInteger(i)||i<0)throw new Error("Undo cache limits must be nonnegative integers.");return this.budgetBytes=n,this.maxSteps=i,this._trim(),this.stats}_trim(){for(;this.usedBytes>this.budgetBytes||this.undoEntries.length+this.redoEntries.length>this.maxSteps;){let e=this.undoEntries.length?this.undoEntries.shift():this.redoEntries.shift();if(!e)break;this.usedBytes-=e.bytes,this.evictedSteps++}this.usedBytes=Math.max(0,this.usedBytes)}prepare({label:e,sections:n,changes:i}){let r={label:String(e),sections:[...n],changes:i};return r.bytes=vi(r),r}push(e){return e.changes.length?this.commit(this.prepare(e)):!1}commit(e){for(let n of this.redoEntries)this.usedBytes-=n.bytes;return this.redoEntries=[],this.undoEntries.push(e),this.usedBytes+=e.bytes,this._trim(),this.lastEntryRetained=this.undoEntries.at(-1)===e,this.lastEntryRetained}setSelection(e,n){if(!this.undoEntries.includes(e)&&!this.redoEntries.includes(e))return!1;if(!pr(n))throw new Error("Invalid selection history.");let{bytes:i,selection:r,...s}=e,o=_t(n),a=vi({...s,selection:o});e.selection=o,e.bytes=a,this.usedBytes+=a-i,this._trim();let c=this.undoEntries.includes(e)||this.redoEntries.includes(e);return c||(this.lastEntryRetained=!1),c}undo(e){let n=this.undoEntries.at(-1);return n?(e(n.changes,"before"),this.undoEntries.pop(),this.redoEntries.push(n),n):null}redo(e){let n=this.redoEntries.at(-1);return n?(e(n.changes,"after"),this.redoEntries.pop(),this.undoEntries.push(n),n):null}get stats(){return{undoSteps:this.undoEntries.length,redoSteps:this.redoEntries.length,usedBytes:this.usedBytes,budgetBytes:this.budgetBytes,maxSteps:this.maxSteps,evictedSteps:this.evictedSteps,undoLabel:this.undoEntries.at(-1)?.label||"",redoLabel:this.redoEntries.at(-1)?.label||"",lastEntryRetained:this.lastEntryRetained}}capture(){return _t(this._recoveryState())}_recoveryState(){return{version:1,budgetBytes:this.budgetBytes,maxSteps:this.maxSteps,evictedSteps:this.evictedSteps,lastEntryRetained:this.lastEntryRetained,undoEntries:this.undoEntries,redoEntries:this.redoEntries}}static restore(e){if(e?.version!==1||!Array.isArray(e.undoEntries)||!Array.isArray(e.redoEntries))throw new Error("Invalid recovery history.");let n=new t(e);for(let i of["undoEntries","redoEntries"])n[i]=e[i].map(r=>{if(typeof r.label!="string"||!Array.isArray(r.sections)||!Array.isArray(r.changes))throw new Error("Invalid recovery history entry.");r.changes.forEach(Vo);let s=_t({label:r.label,sections:r.sections,changes:r.changes,...pr(r.selection)?{selection:r.selection}:{}});return s.bytes=vi(s),n.usedBytes+=s.bytes,s});return n.evictedSteps=Number.isSafeInteger(e.evictedSteps)&&e.evictedSteps>=0?e.evictedSteps:0,n.lastEntryRetained=e.lastEntryRetained!==!1,n._trim(),n}};import{Buffer as Dt}from"buffer";function Go(t){let e=Dt.from(t),n=Xe(e).tokens.filter(h=>!["whitespace","line-comment","block-comment"].includes(h.kind)),i=h=>h?.raw.toString("utf8"),r=null,s=null,o=null,a=null,c=0;for(let h=0;h<n.length;h++){let l=n[h],d=i(l);if(d==="{"&&c++,d==="}"&&c--,c===1&&d==="ObjectId"&&(r=Number(i(n[h+1]))),c===1&&d==="EventTrack"&&i(n[h+2])==="{"){o=n[h+2];for(let u=h+3;u<n.length&&i(n[u])!=="}";u++)if(i(n[u])==="GlobalSeqId"){if(a)throw new Error("EventTrack contains more than one GlobalSeqId.");let f=Number(i(n[u+1]));if(!Number.isInteger(f)||f<0||f>2147483647||i(n[u+2])!==",")throw new Error("EventTrack GlobalSeqId must be a non-negative integer.");s=f,a={start:n[u].start,end:n[u+2].end}}}}return{bytes:e,objectId:r,globalSeqId:s,trackOpen:o,remove:a}}function ko(t){let{bytes:e,objectId:n,globalSeqId:i,remove:r}=Go(t);return{objectId:n,globalSeqId:i,bytes:r?Dt.concat([e.subarray(0,r.start),Dt.from(" "),e.subarray(r.end)]):e}}function zo(t,e,n){let i=Dt.from(t),r=new Map((n.EventObjects||[]).map(a=>[a.ObjectId,a])),s=[],o=0;for(let a of e){if(a.key!=="EventObjects")continue;let c=i.subarray(a.start,a.end),{objectId:h,trackOpen:l}=Go(c),d=r.get(h)?.GlobalSeqId;if(!Number.isInteger(d)||d<0||!l)continue;let u=a.start+l.end;s.push(i.subarray(o,u),Dt.from(`
		GlobalSeqId ${d},`)),o=u}return s.push(i.subarray(o)),Dt.concat(s)}function Ho(t,e){for(let n of et(t).chunks)if(n.tag==="EVTS"){let i=n.payloadOffset+n.declaredSize;for(let r=n.payloadOffset;r<i;){if(r+96>i)throw new Error("Truncated EventObject node.");let s=t.readUInt32LE(r),o=r+s;if(s<96||o+12>i||t.toString("ascii",o,o+4)!=="KEVT")throw new Error("Invalid EventObject track layout.");let a=t.readUInt32LE(o+4),c=o+12+a*4;if(c>i)throw new Error("Truncated EventObject track.");e({objectId:t.readInt32LE(r+84),globalSeqId:t.readInt32LE(o+8),offset:o+8}),r=c}}}function Wo(t,e){let n=Dt.from(t),i=new Map((e.EventObjects||[]).map(r=>[r.ObjectId,r]));Ho(n,({objectId:r,globalSeqId:s})=>{let o=i.get(r);o&&s>=0&&(o.GlobalSeqId=s)})}function gr(t,e){let n=Dt.from(t),i=new Map((e.EventObjects||[]).map(r=>[r.ObjectId,r]));return Ho(n,({objectId:r,offset:s})=>{let o=i.get(r)?.GlobalSeqId;n.writeInt32LE(Number.isInteger(o)&&o>=0?o:-1,s)}),n}import{Buffer as Au}from"buffer";function Xo(t,e,n){let i=Au.from(t),r=new Map((n.ParticleEmitterPopcorns||[]).map(s=>[s.ObjectId,s]));if(r.size)for(let s of e){if(s.key!=="ParticleEmitterPopcorns")continue;let o=i.subarray(s.start,s.end),a=Xe(o).tokens.filter(u=>!["whitespace","line-comment","block-comment"].includes(u.kind)),c=u=>u?.raw.toString("utf8"),h=0,l=null,d=null;for(let u=0;u<a.length;u++){let f=c(a[u]);if(f==="{"&&h++,f==="}"&&h--,h===1&&f==="ObjectId"&&(l=Number(c(a[u+1]))),h===1&&f==="Rotation"&&c(a[u+2])==="{"){if(d)throw new Error("Popcorn emitter contains duplicate rotation controllers.");let p=0,m=-1;for(let x=u+2;x<a.length;x++)if(c(a[x])==="{"&&p++,c(a[x])==="}"&&--p===0){m=a[x].end;break}if(m<0)throw new Error("Popcorn rotation controller is incomplete.");d=o.subarray(a[u].start,m).toString("utf8").replace(/\/\*[\s\S]*?\*\//g," ")}}if(d&&r.has(l)){let u=ii(`Version { FormatVersion 800, } Helper "PopcornRotation" { ObjectId 0, ${d} }`);r.get(l).Rotation=u.Helpers[0].Rotation}}}function qo(t=[]){return t.map(e=>{let n=structuredClone(e.Color);if(n?.Keys)for(let i of n.Keys)for(let r of["Vector","InTan","OutTan"])i[r]?.reverse();else(Array.isArray(n)||ArrayBuffer.isView(n))&&n.reverse();return{...e,Color:n}})}import{Buffer as vr}from"buffer";function $o(t,e,n){let i=vr.from(t),r=[],s=0,o=0;for(let a of e){if(a.key!=="Geosets")continue;let c=n.Geosets[o++]?.TVertices||[];if(c.length<2)continue;let h=Xe(i.subarray(a.start,a.end)).tokens.filter(m=>!["whitespace","line-comment","block-comment"].includes(m.kind)),l=0,d=0,u=null;for(let m of h){let x=m.raw.toString("ascii");x==="{"&&l++,l===1&&x==="TVertices"&&m.kind!=="string"&&d++,x==="}"&&(l--,l===0&&(u=m))}if(!u||d>=c.length)continue;let f=c.slice(d).map(m=>{if(m.length%2||Array.from(m).some(g=>!Number.isFinite(g)))throw new Error("Cannot write invalid UV coordinates.");let x=[];for(let g=0;g<m.length;g+=2)x.push(`		{ ${m[g]}, ${m[g+1]} },`);return`	TVertices ${m.length/2} {
${x.join(`
`)}
	}
`}).join(""),p=a.start+u.start;r.push(i.subarray(s,p),vr.from(f)),s=p}return r.push(i.subarray(s)),vr.concat(r)}function yi(t=[]){return t.map(e=>e.Color?.Keys?{...e,Color:{...e.Color,Keys:e.Color.Keys.map(n=>{let i={...n};for(let r of["Vector","InTan","OutTan"])n[r]&&(i[r]=new Float32Array([n[r][2],n[r][1],n[r][0]]));return i})}}:e)}var _e=(t=0,e=0,n=0)=>new Float32Array([t,e,n]),ve=t=>structuredClone(t),it=Object.freeze({Bone:["Bones","BONE",256],Helper:["Helpers","HELP",0],Attachment:["Attachments","ATCH",2048],Light:["Lights","LITE",512],EventObject:["EventObjects","EVTS",1024],CollisionShape:["CollisionShapes","CLID",8192],ParticleEmitter:["ParticleEmitters","PREM",4096],ParticleEmitter2:["ParticleEmitters2","PRE2",4096],RibbonEmitter:["RibbonEmitters","RIBB",16384],ParticleEmitterPopcorn:["ParticleEmitterPopcorns","CORN",4096]}),Le={Version:["Version","VERS"],Info:["Model","MODL"],Sequences:["Sequences","SEQS"],GlobalSequences:["GlobalSequences","GLBS"],Materials:["Materials","MTLS"],Textures:["Textures","TEXS"],TextureAnims:["TextureAnims","TXAN"],Geosets:["Geoset","GEOS"],GeosetAnims:["GeosetAnim","GEOA"],PivotPoints:["PivotPoints","PIVT"],Cameras:["Camera","CAMS"],FaceFX:["FaceFX","FAFX"],BindPoses:["BindPose","BPOS"],Gliders:["Glider","DILG"],...Object.fromEntries(Object.entries(it).map(([t,[e,n]])=>[e,[t,n]]))},Eu=Object.fromEntries(Object.entries(Le).map(([t,e])=>[e[0],t])),wu=["TextureID","NormalTextureID","ORMTextureID","EmissiveTextureID","TeamColorTextureID","ReflectionsTextureID"],yr=t=>Object.values(it).flatMap(([e])=>t[e]||[]),Ut=t=>JSON.stringify(t,(e,n)=>ArrayBuffer.isView(n)?{$type:n.constructor.name,$data:Array.from(n)}:typeof n=="number"&&!Number.isFinite(n)?{$number:String(n)}:n),_i=new Set(Object.values(it).map(([t])=>t)),kn=t=>t[0]==="Nodes"||t.length===3&&_i.has(t[0])&&t[2]==="PivotPoint",Yo=(t,e)=>Object.fromEntries([...e].filter(n=>n!=="Nodes").map(n=>[n,t[n]]));function Pu(t=800,e="Untitled"){let n={Version:t,Info:{Name:e,MinimumExtent:_e(),MaximumExtent:_e(),BoundsRadius:0,BlendTime:150},Nodes:[]};for(let i of Object.keys(Le))!(i in n)&&i!=="Version"&&(n[i]=[]);return n}function zn(t){let e=ke.from(t),n=[],i=-1,r="",s=0,o=0;for(;o<e.length;){let a=e[o];if(a===47&&e[o+1]===47)for(o+=2;o<e.length&&e[o]!==10&&e[o]!==13;)o++;else if(a===47&&e[o+1]===42){let c=e.indexOf(ke.from("*/"),o+2);if(c<0)throw new Error("Unterminated MDL block comment.");o=c+2}else if(a===34){let c=sr(e,o);if(c<0)throw new Error("Unterminated MDL string.");o=c}else if(a===123)s++,o++;else if(a===125){if(--s<0)throw new Error("Unmatched MDL closing brace.");o++,s===0&&i>=0&&(n.push({name:r,key:Eu[r],start:i,end:o}),i=-1)}else if(s===0&&i<0&&(a>=65&&a<=90||a>=97&&a<=122||a===95)){for(i=o++;o<e.length&&/[A-Za-z0-9_]/.test(String.fromCharCode(e[o]));)o++;r=e.subarray(i,o).toString("ascii")}else o++}if(s!==0)throw new Error("Unterminated MDL section.");if(i>=0)throw new Error(`Incomplete MDL section ${r}.`);return n}function Cu(t){return t.replace(/"[^"]*"|\/\*[\s\S]*?\*\//g,e=>e.startsWith("/*")?" ":e)}function Ko(t){return t.replace(/"(?:\\.|[^"\\])*"|Faces\s+1\s+0\s*\{\s*Triangles\s*\{\s*\{\s*\},?\s*\}\s*\}/g,e=>e.startsWith('"')?e:"Faces 0 0 { Triangles { } }")}function Ru(t,e){let n=new Map,i=e.filter(a=>a.key&&a.key!=="PivotPoints").map(a=>{let c=t.subarray(a.start,a.end);if(a.key==="EventObjects"){let h=ko(c);c=h.bytes,h.globalSeqId!=null&&n.set(h.objectId,h.globalSeqId)}return Cu(c.toString("utf8"))}).join(`
`),r=To(Ko(i)),s=ii(r.text);r.restore(s);for(let a of s.ParticleEmitters||[])a.Flags|=4096;Xo(t,e,s);for(let a of s.EventObjects||[])n.has(a.ObjectId)&&(a.GlobalSeqId=n.get(a.ObjectId));for(let a of s.GeosetAnims||[])a.Color!=null&&(a.Flags=(a.Flags||0)|2);let o=e.filter(a=>a.key==="PivotPoints");return o.length&&(s.PivotPoints=wo(t.subarray(o.at(-1).start,o.at(-1).end))),bt(s),s}function bt(t,e){for(let r of Object.keys(Le))r!=="Version"&&r!=="Info"&&t[r]==null&&(t[r]=[]);t.Nodes=[];for(let r of yr(t)){let s=r.ObjectId;if(!Number.isInteger(s)||s<0||s>1e6)continue;r.Parent===void 0&&(r.Parent=null);let o=e?.Nodes?.[s],a=e?.PivotPoints?.[s],c=o&&Ut(o.PivotPoint)!==Ut(r.PivotPoint),h=a&&Ut(a)!==Ut(t.PivotPoints[s]);c&&!h&&(t.PivotPoints[s]=r.PivotPoint),t.PivotPoints[s]||(t.PivotPoints[s]=r.PivotPoint||_e()),r.PivotPoint=t.PivotPoints[s],t.Nodes[s]=r}for(let r=0;r<t.PivotPoints.length;r++)t.PivotPoints[r]||=_e();let n=new Set;function i(r){if(!(!r||typeof r!="object"||ArrayBuffer.isView(r)||n.has(r))){if(n.add(r),Array.isArray(r.Keys)){r.GlobalSeqId===void 0&&(r.GlobalSeqId=null);return}for(let s of Object.values(r))i(s)}}i(t);for(let r of t.Materials)for(let s of r.Layers||[])s.TVertexAnimId===void 0&&(s.TVertexAnimId=null),s.CoordId??=0,s.FilterMode??=0,s.Shading??=0;for(let r of t.Bones)r.GeosetId??=null,r.GeosetAnimId??=null;for(let r of t.Lights)r.QuadraticFalloff??=5e-4,r.LinearFalloff??=0,r.Damping??=1e-5;for(let[r,s]of t.Geosets.entries())e&&Ut(e.Geosets[r]?.Faces)!==Ut(s.Faces)&&s.PrimitiveCounts&&Array.from(s.PrimitiveCounts).reduce((o,a)=>o+a,0)!==s.Faces.length&&(s.PrimitiveTypes=Uint32Array.of(4),s.PrimitiveCounts=Uint32Array.of(s.Faces.length));for(let r of t.ParticleEmitters2)for(let s of["TailLength","Time","LifeSpan","PriorityPlane","ReplaceableId","Rows","Columns"])r[s]??=0;for(let r of t.ParticleEmitters)for(let s of["EmissionRate","Gravity","Longitude","Latitude","LifeSpan","InitVelocity"])r[s]??=0;for(let r of t.ParticleEmitterPopcorns){for(let s of["LifeSpan","EmissionRate","Speed","Alpha"])r[s]??=1;r.ReplaceableId??=0,r.Path??="",r.AnimVisibilityGuide??="",r.Color??=_e(1,1,1)}for(let r of t.RibbonEmitters)r.HeightAbove??=0,r.HeightBelow??=0,r.Alpha??=1,r.TextureSlot??=0;for(let r of[t.Info,...t.Sequences,...t.Geosets,...t.Geosets.flatMap(s=>s.Anims||[])])r&&(r.MinimumExtent||=_e(),r.MaximumExtent||=_e(),r.BoundsRadius??=0);t.Info&&(t.Info.BlendTime??=0);for(let r of t.Textures)r.Image??="",r.ReplaceableId??=0,r.Flags??=0;for(let r of t.ParticleEmitters2)r.Squirt=!!r.Squirt;Jo(t)}function Iu(t,e,n,i){let r=zn(n),s=new Map;for(let l of i)s.set(l,ke.concat(r.filter(d=>d.key===l).flatMap(d=>[n.subarray(d.start,d.end),ke.from(`
`)])));let o=[],a=new Set,c=0;for(let l of e)s.has(l.key)&&(o.push(t.subarray(c,l.start)),a.has(l.key)||(o.push(s.get(l.key)),a.add(l.key)),c=l.end);o.push(t.subarray(c));for(let[l,d]of s)!a.has(l)&&d.length&&o.push(ke.from(`
`),d);let h=ke.concat(o);return jo(h)}function jo(t){let e=zn(t).filter(s=>_i.has(s.key)),n=[...e].sort((s,o)=>mi.indexOf(s.key)-mi.indexOf(o.key)),i=[],r=0;return e.forEach((s,o)=>{let a=n[o];i.push(t.subarray(r,s.start),t.subarray(a.start,a.end)),r=s.end}),i.push(t.subarray(r)),ke.concat(i)}function Lu(t,e,n,i){let r=et(n);if(r.hasErrors)throw new Error("Generated MDX has an invalid chunk structure.");let s=new Set(i.map(h=>Le[h][1])),o=new Map([...s].map(h=>[h,ke.concat(r.chunks.filter(l=>l.tag===h).map(l=>n.subarray(l.offset,l.payloadOffset+l.declaredSize)))])),a=new Set,c=[t.subarray(0,4)];for(let h of e.chunks)s.has(h.tag)?a.has(h.tag)||(c.push(o.get(h.tag)),a.add(h.tag)):c.push(t.subarray(h.offset,h.payloadOffset+h.declaredSize));for(let[h,l]of o)a.has(h)||c.push(l);return c.push(e.trailingBytes),ke.concat(c)}var xr=class t{constructor(e,n="Untitled.mdl",i={}){if(this.name=n,this.revision=0,this.history=[],this._historyStore=new Gn(i.history),this._serializedStates=new WeakMap,this._loadSource(e),this.model=Pu(this.version||800,n),this.readOnly=this._sourceErrors.length>0||!xt.includes(this.version),!this.readOnly)try{this.model=this.format==="mdx"?po(this._original):Ru(this._original,this._sections),this.format==="mdx"&&(Wo(this._original,this.model),this.model.GeosetAnims=yi(this.model.GeosetAnims)),bt(this.model)}catch(r){this.readOnly=!0,this._sourceErrors.push({severity:"error",code:"SEMANTIC_DECODE_FAILED",message:`Editing unavailable: ${r.message}. The original file can still be copied exactly.`})}this._savedModel=ve(this.model),this._committedModel=ve(this.model),this._dirtyCandidates=new Set(Object.keys(this.model)),this._trackedModel=this.model,this._recoverySavedChanges=[]}_loadSource(e){if(this._original=typeof e=="string"?ke.from(e,"utf8"):ke.from(e instanceof ArrayBuffer?new Uint8Array(e):e),this.format=this._original.subarray(0,4).toString("ascii")==="MDLX"?"mdx":"mdl",this._container=this.format==="mdx"?et(this._original):Xe(this._original),this.version=this._container.version,this._sourceErrors=this._container.diagnostics.filter(n=>n.severity==="error"),this._sourceWarnings=this._container.diagnostics.filter(n=>n.severity!=="error"),this._sections=[],this.format==="mdl")try{this._sections=zn(this._original)}catch(n){this._sourceErrors.push({severity:"error",code:"MDL_STRUCTURE",message:n.message})}}get originalBytes(){return new Uint8Array(this._original)}_candidateKeys(){return this.model!==this._trackedModel&&(this._dirtyCandidates=new Set([...Object.keys(this._savedModel),...Object.keys(this.model)]),this._trackedModel=this.model,this._changeCache=null),this._dirtyCandidates}_changedKeys(){let e=this._candidateKeys();if(this._changeCache?.revision!==this.revision){let n=yn(Yo(this._savedModel,e),Yo(this.model,e),{ignore:kn});this._dirtyCandidates=new Set(n.map(i=>i.path[0])),this._changeCache={revision:this.revision,keys:[...new Set(n.map(i=>i.path[0]).filter(i=>i in Le))]}}return this._changeCache.keys}get dirty(){return this._changedKeys().length>0}get canUndo(){return this._historyStore.stats.undoSteps>0}get canRedo(){return this._historyStore.stats.redoSteps>0}get historyStats(){return this._historyStore.stats}configureHistory(e){return this._historyStore.configure(e)}_recordHistory(e){this.history.push(e);let n=Math.max(1,this.historyStats.maxSteps);this.history.length>n&&this.history.splice(0,this.history.length-n)}get diagnostics(){if(this._diagnosticCache?.revision===this.revision)return this._diagnosticCache.diagnostics;let e=[...this._sourceErrors,...this._sourceWarnings];this.readOnly||e.push(...Nt(this.model));let n=this._unknownSections();return n.length&&e.push({severity:"info",code:"OPAQUE_DATA_PRESERVED",message:`Unrecognized source data is retained: ${n.join(", ")}.`}),this._diagnosticCache={revision:this.revision,diagnostics:e},e}_unknownSections(){let e=new Set(Object.values(Le).map(n=>n[1]));return this.format==="mdx"?[...new Set(this._container.chunks.filter(n=>!e.has(n.tag)).map(n=>n.tag))]:[...new Set(this._sections.filter(n=>!n.key).map(n=>n.name))]}convertVersion(e){if(this.readOnly)throw new Error("This document is read-only.");if(e===this.model.Version)return!1;let n=as(this.model,e);if(this._unknownSections().length&&n.push("Unrecognized source sections prevent safe version conversion."),n.length)throw new Error(n.join(`
`));let i=ve(this.model);Wi(i,e);let r=gr(ui({...i,GeosetAnims:yi(i.GeosetAnims),BindPoses:i.BindPoses?.length?i.BindPoses:void 0}),i),s=rn(r,"converted.mdx");if(s.readOnly||s.version!==e||s.diagnostics.some(o=>o.severity==="error"))throw new Error("Target format verification failed. The model was kept.");fr(i,s.model,{keys:Object.keys(Le)});for(let o of Object.keys(Le))if(Array.isArray(i[o])&&i[o].length!==s.model[o]?.length)throw new Error("Target conversion changed "+o+" count.");this._versionConversion=!0;try{return this.apply("Convert to MDX"+e,["Version","Materials","Geosets"],o=>Wi(o,e))}finally{this._versionConversion=!1}}apply(e,n,i){if(this.readOnly)throw new Error(`This document is read-only (format ${this.version??"unknown"} or unsupported data).`);if(typeof i!="function")throw new TypeError("apply requires a model mutator function.");if(this._applying)throw new Error("Nested document edits are not supported.");let r=this._committedModel,s=this.model;this._candidateKeys();let o,a,c,h;this._applying=!0;try{if(o=i(s),o&&typeof o.then=="function")throw new Error("Document edits must be synchronous.");if(s.Version!==r.Version&&!this._versionConversion)throw new Error("Changing the model version is not supported; no automatic downgrades are performed.");bt(s,r),a=yn(r,s,{ignore:kn}),c=[...new Set(a.map(m=>m.path[0]).filter(m=>m in Le))];let l=this._committedDiagnostics||=Nt(r),d=this._committedErrors||=new Set(l.filter(m=>m.severity==="error").map(m=>`${m.code}:${m.path}`)),u=c.includes("GlobalSequences")?null:new Set(a.map(m=>m.path[0]));if(u&&(u.has("PivotPoints")||c.some(m=>_i.has(m)))){u.add("PivotPoints");for(let m of _i)u.add(m)}let f=Nt(s,{numericSections:u,previousDiagnostics:l}),p=f.filter(m=>m.severity==="error"&&!d.has(`${m.code}:${m.path}`));if(p.length)throw new Error(p.slice(0,4).map(m=>m.message).join(`
`));a.length&&(h=this._historyStore.prepare({label:e,sections:c,changes:a})),_n(r,a),bt(r),this._committedErrors=new Set(f.filter(m=>m.severity==="error").map(m=>`${m.code}:${m.path}`)),this._committedDiagnostics=f}catch(l){throw this.model=ve(r),this._trackedModel=this.model,l}finally{this._applying=!1}if(!a.length)return!1;this._historyStore.commit(h),this.model=s;for(let l of a)this._dirtyCandidates.add(l.path[0]);return this.version=this.model.Version,this.revision++,this._recordHistory({label:e,sections:c,requestedSections:[...n||[]],revision:this.revision}),o===void 0?!0:o}undo(){if(this._applying)throw new Error("Cannot undo inside a document edit.");let e=this._historyStore.undo((n,i)=>this._applyHistory(n,i));return e?(e.changes.length&&this.revision++,this._recordHistory({label:`Undo: ${e.label}`,sections:e.sections,revision:this.revision}),!0):!1}redo(){if(this._applying)throw new Error("Cannot redo inside a document edit.");let e=this._historyStore.redo((n,i)=>this._applyHistory(n,i));return e?(e.changes.length&&this.revision++,this._recordHistory({label:`Redo: ${e.label}`,sections:e.sections,revision:this.revision}),!0):!1}_applyHistory(e,n){_n(this._committedModel,e,n),bt(this._committedModel);try{_n(this.model,e,n),bt(this.model)}catch{this.model=ve(this._committedModel)}this.version=this.model.Version,this._committedErrors=null,this._committedDiagnostics=null;for(let i of e)this._dirtyCandidates.add(i.path[0]);this._trackedModel=this.model}captureRecoveryState({includeHistory:e=!0,compact:n=!1}={}){if(this._applying)throw new Error("Cannot capture recovery inside a document edit.");return n?(this._candidateKeys(),ve({schema:"mdlvis-document-recovery",version:2,name:this.name,originalBytes:new Uint8Array(this._original.buffer,this._original.byteOffset,this._original.byteLength),savedChanges:this._recoverySavedChanges,modelChanges:yn(this._savedModel,this.model,{ignore:kn}),revision:this.revision,history:e?this._historyStore._recoveryState():null,activity:this.history})):ve({schema:"mdlvis-document-recovery",version:1,name:this.name,originalBytes:new Uint8Array(this._original.buffer,this._original.byteOffset,this._original.byteLength),model:this.model,savedModel:this._savedModel,revision:this.revision,history:e?this._historyStore._recoveryState():null,activity:this.history})}static restoreRecoveryState(e){if(e?.schema!=="mdlvis-document-recovery"||![1,2].includes(e.version)||!(e.originalBytes instanceof Uint8Array)||typeof e.name!="string"||(e.version===1?!e.model:!Array.isArray(e.savedChanges)||!Array.isArray(e.modelChanges)))throw new Error("Invalid document recovery data.");let n=new t(e.originalBytes,e.name),i,r;if(e.version===2?(i=ve(n.model),_n(i,e.savedChanges),bt(i),r=ve(i),_n(r,e.modelChanges)):(i=e.savedModel,r=ve(e.model)),!i||i.Version!==n.version||![800,1e3,n.version].includes(r.Version))throw new Error("Recovery model version does not match its original file.");bt(r);let s=new Set(Nt(n.model).filter(a=>a.severity==="error").map(a=>`${a.code}:${a.path}`)),o=Nt(r).filter(a=>a.severity==="error"&&!s.has(`${a.code}:${a.path}`));if(o.length)throw new Error(`Recovery model is invalid: ${o[0].message}`);return n.model=r,n.version=r.Version,n._committedModel=ve(r),n._recoverySavedChanges=e.version===2?ve(e.savedChanges):yn(n._savedModel,i,{ignore:kn}),n._savedModel=ve(i),bt(n._savedModel),n._dirtyCandidates=new Set(Object.keys(r)),n._trackedModel=r,e.history&&(n._historyStore=Gn.restore(e.history)),n.revision=Number.isSafeInteger(e.revision)&&e.revision>=0?e.revision:0,n.history=Array.isArray(e.activity)?ve(e.activity.slice(-Math.max(1,n.historyStats.maxSteps))):[],n}saveImpact(e=this.format){e=e.toLowerCase();let n=e!==this.format||this.model.Version!==this._container.version,i=this._changedKeys(),r=[];n?r.push("Format conversion regenerates the entire file. Unknown chunks, unknown MDL sections, comments and unsupported fields cannot be carried into the other format."):i.length&&r.push("Changed sections are regenerated. Their formatting, comments and unsupported subfields may change; all other source sections remain byte-for-byte intact."),this.version===900&&r.push("Version 900 support in the parser library is experimental."),this.readOnly&&n&&r.push("This document cannot be converted because its version or source data is unsupported."),n&&this.model.Geosets?.some(a=>a.SkinWeights?.length)&&e==="mdl"&&r.push("Weighted HD geometry requires a compatible Reforged MDL consumer.");let s=(n||i.length)&&!this.readOnly?Fu(this.model,e,n?Object.keys(Le):i):[];r.push(...s);let o=this._unknownSections();return n&&o.length&&r.push(`Cannot convert unrecognized source data: ${o.join(", ")}.`),{format:e,conversion:n,exact:!n&&i.length===0,readOnly:this.readOnly,changedSections:i.map(a=>a==="Info"?"Model":a),preservedUnknown:o,warnings:r,canSave:["mdl","mdx"].includes(e)&&(!this.readOnly||!n&&!i.length)&&!s.length&&!(n&&o.length)}}serialize(e=this.format,{timings:n={}}={}){Object.assign(n,{serializationMs:0,reparsingMs:0,verificationMs:0,errorFormattingMs:0});let i="serializationMs",r=performance.now(),s=o=>{let a=performance.now();n[i]+=a-r,i=o,r=a};try{e=e.toLowerCase();let o=this.saveImpact(e);if(!o.canSave)throw new Error(`This document cannot be saved in that format. ${o.warnings.at(-1)||"An exact copy in its original format is available."}`);let a=b=>{let M=new Uint8Array(b);return this._serializedStates.set(M,{model:ve(this.model),revision:this.revision}),M};if(o.exact)return a(this._original);let c=this.model;lr(c).some((b,M)=>b.ObjectId!==M)&&(c=ve(c),Po(c,{preserveUnusedPivots:!0}));let h=Lo(this.model.GeosetAnims,e);if(h.length)throw s("errorFormattingMs"),new Error(gi("Cannot export geoset colors",h));let l=Io(c.GeosetAnims,e),d=e==="mdl"?{...c,ParticleEmitterPopcorns:qo(c.ParticleEmitterPopcorns),GeosetAnims:l}:{...c,GeosetAnims:yi(l),BindPoses:c.BindPoses?.length?c.BindPoses:void 0},u=e==="mdl"?{...d,Geosets:d.Geosets.map(b=>({...b,TVertices:b.TVertices.length?b.TVertices:[new Float32Array]})),CollisionShapes:d.CollisionShapes.map(b=>[1,3].includes(b.Shape)?{...b,Shape:0}:b)}:null,f=e==="mdl"?Ao(ke.from(Ko(ps(u)),"utf8"),{...c,GeosetAnims:l}):ke.from(ui(d));e==="mdl"&&(f=$o(f,zn(f),d)),f=e==="mdl"?zo(f,zn(f),d):gr(f,d),e==="mdl"&&(f=jo(Eo(f)));let p=this._recoverySavedChanges.length?rn(this._original,this.name).model:this._savedModel;o.conversion||(f=e==="mdx"?No(this._original,f,p,c,Le):Bo(this._original,f,p,c,Le));let m=c!==this.model||this._recoverySavedChanges.length?Object.keys(Le).filter(b=>Ut(p[b])!==Ut(c[b])):this._changedKeys(),x=o.conversion?f:e==="mdl"?Iu(this._original,this._sections,f,m):Lu(this._original,this._container,f,m);s("reparsingMs");let g=rn(x,`validation.${e}`);if(s("verificationMs"),g.readOnly)throw s("errorFormattingMs"),new Error(gi("Save verification failed",g.diagnostics.filter(b=>b.severity==="error").map(b=>b.message)));if(g.version!==this.version)throw new Error("Save verification failed: model version changed.");fr(c,g.model,{keys:Object.keys(Le),timings:n});for(let b of Object.keys(Le))if(Array.isArray(this.model[b])&&this.model[b].length!==g.model[b]?.length)throw new Error(`Save verification failed: ${b} count changed during serialization.`);for(let b=0;b<this.model.Geosets.length;b++)if(this.model.Geosets[b].TVertices.length!==g.model.Geosets[b].TVertices.length)throw new Error(`Save verification failed: Geoset ${b} UV set count changed during serialization.`);let y=new Set(Nt(this.model).filter(b=>b.severity==="error").map(b=>`${b.code}:${b.path}`)),v=g.diagnostics.filter(b=>b.severity==="error"&&!y.has(`${b.code}:${b.path}`));if(v.length)throw s("errorFormattingMs"),new Error(gi("Save verification failed",v.map(b=>b.message)));return a(x)}finally{n[i]+=performance.now()-r,i==="verificationMs"&&(n.verificationMs-=n.errorFormattingMs),this.lastSaveTimings={...n}}}rememberSerializedSnapshot(e,n,i=this.revision){this._serializedStates.set(e,{model:ve(n),revision:i})}markSaved(e,n=this.name){let i=e||this.serialize(),r=this._serializedStates.get(i),s=r?r.model:rn(i,n).model;this.name=n,this._loadSource(i),this.version=this.model.Version,this._savedModel=ve(s),this._recoverySavedChanges=yn(rn(i,n).model,s,{ignore:kn}),this._dirtyCandidates=new Set([...Object.keys(this._savedModel),...Object.keys(this.model)]),this._trackedModel=this.model,this.revision++}};function rn(t,e,n){return new xr(t,e,n)}function Fu(t,e,n){let i=[],r=new Set;function s(o,a,c){if(typeof o=="string"){if(e==="mdl"&&(/["\0]/.test(o)||c!=="AnimVisibilityGuide"&&/[\r\n]/.test(o))&&i.push(`${a} contains a quote, newline or NUL that this MDL writer cannot safely encode.`),e==="mdx"){[...o].some(l=>l.charCodeAt(0)>255)&&i.push(`${a} contains Unicode characters that this MDX writer cannot encode. Save as MDL or use a compatible name.`);let h=["Image","Path","AnimationFile","AnimVisibilityGuide"].includes(c)?260:["Name","Shader"].includes(c)?80:null;h&&o.length>h&&i.push(`${a} exceeds its ${h}-byte MDX field; saving would truncate it.`)}return}if(!(!o||typeof o!="object"||ArrayBuffer.isView(o)||r.has(o))){r.add(o);for(let[h,l]of Object.entries(o))s(l,`${a}.${h}`,h)}}for(let o of n)s(t[o],o,o);return i}function Nt(t,{numericSections:e=null,previousDiagnostics:n=[]}={}){let i=[],r=(u,f,p,m)=>i.push({severity:u,code:f,message:p,path:m});if(!t)return[{severity:"error",code:"NO_MODEL",message:"No model is loaded."}];let s=yr(t),o=new Map;for(let u of s){let f=`Nodes[${u.ObjectId}]`;(!Number.isInteger(u.ObjectId)||u.ObjectId<0||u.ObjectId>1e6)&&r("error","NODE_ID",`Node ${u.Name} has an invalid object ID.`,f),o.has(u.ObjectId)&&r("error","DUPLICATE_NODE_ID",`Object ID ${u.ObjectId} is used by more than one node.`,f),o.set(u.ObjectId,u),(!u.PivotPoint||u.PivotPoint.length!==3)&&r("error","NODE_PIVOT",`Node ${u.Name} has no valid pivot point.`,f)}for(let u of s){let f=`Nodes[${u.ObjectId}]`;u.Parent!=null&&u.Parent!==-1&&!o.has(u.Parent)&&r("error","NODE_PARENT",`Node ${u.Name} references missing parent ${u.Parent}.`,f);let p=new Set([u.ObjectId]),m=u;for(;m&&m.Parent!=null&&m.Parent!==-1;){if(p.has(m.Parent)){r("error","HIERARCHY_CYCLE",`Node ${u.Name} would create a hierarchy cycle.`,f);break}p.add(m.Parent),m=o.get(m.Parent)}}for(let[u,f]of(t.Geosets||[]).entries()){let p=`Geosets[${u}]`,m=(f.Vertices?.length||0)/3;(!Number.isInteger(m)||!m)&&r("error","VERTEX_COUNT",`Geoset ${u} has invalid or empty vertex data.`,p),m>65536&&r("error","FACE_INDEX_LIMIT",`Geoset ${u} exceeds MDX's 16-bit face index capacity; split it into geosets.`,p),f.Normals?.length!==f.Vertices?.length&&r("error","NORMAL_COUNT",`Geoset ${u} normals do not match its vertices.`,p),(!ArrayBuffer.isView(f.Faces)||f.Faces.length%3)&&r("error","TRIANGLE_COUNT",`Geoset ${u} has invalid triangle data.`,p),f.Faces?.some(g=>g>=m||g<0||!Number.isInteger(g))&&r("error","FACE_REFERENCE",`Geoset ${u} contains a face with a missing vertex.`,p),(!Number.isInteger(f.MaterialID)||!t.Materials?.[f.MaterialID])&&r("error","MATERIAL_REFERENCE",`Geoset ${u} references missing material ${f.MaterialID}.`,p),f.TVertices?.length||r("warning","MISSING_UV",`Geoset ${u} has no texture coordinates.`,p),f.TVertices?.length>16&&r("error","UV_SET_LIMIT",`Geoset ${u} exceeds the 16 UV set limit.`,p);for(let[g,y]of(f.TVertices||[]).entries())y.length!==m*2&&r("error","UV_COUNT",`Geoset ${u} UV set ${g} has a mismatched vertex count.`,`${p}.TVertices[${g}]`);f.VertexGroup?.length!==m&&r("error","VERTEX_GROUP_COUNT",`Geoset ${u} vertex groups do not match its vertices.`,p),f.VertexGroup?.some(g=>g>=(f.Groups?.length||0))&&r("error","GROUP_REFERENCE",`Geoset ${u} references a missing matrix group.`,p);for(let g of new Set((f.Groups||[]).flat()))o.has(g)||r("error","BONE_REFERENCE",`Geoset ${u} references missing matrix node ${g}.`,`${p}.Groups[${g}]`);if(f.SkinWeights?.length){f.SkinWeights.length!==m*8&&r("error","SKIN_COUNT",`Geoset ${u} skin weights do not match its vertices.`,p),f.SkinWeights.some((v,b)=>!Number.isInteger(v)||v<0||v>(b%8<4&&t.Version>=1400?65535:255))&&r("error","SKIN_VALUE_RANGE",`Geoset ${u} skin indices or weights exceed their format range.`,p);let g=new Set,y=!1;for(let v=0;v<f.SkinWeights.length;v+=8){let b=0;for(let M=0;M<4;M++){let _=f.SkinWeights[v+4+M];b+=_,_&&!o.has(f.SkinWeights[v+M])&&g.add(f.SkinWeights[v+M])}b!==255&&(y=!0)}for(let v of g)r("error","SKIN_BONE_REFERENCE",`Geoset ${u} weights reference missing node ${v}.`,`${p}.SkinWeights[${v}]`);y&&r("warning","SKIN_WEIGHT_SUM",`Geoset ${u} has vertex weights that do not total 255.`,p)}f.Tangents?.length&&f.Tangents.length!==m*4&&r("error","TANGENT_COUNT",`Geoset ${u} tangents do not match its vertices.`,p);let x=0;for(let g=0;g<(f.Faces?.length||0);g+=3)(f.Faces[g]===f.Faces[g+1]||f.Faces[g]===f.Faces[g+2]||f.Faces[g+1]===f.Faces[g+2])&&x++;x&&r("warning","DEGENERATE_FACES",`Geoset ${u} has ${x} triangles with repeated vertices.`,p)}let a=(u,f)=>{u!=null&&u!==-1&&(!Number.isInteger(u)||!t.Textures?.[u])&&r("error","TEXTURE_REFERENCE",`${f} references missing texture ${u}.`,f)};for(let[u,f]of(t.Materials||[]).entries()){f.Layers?.length||r("error","EMPTY_MATERIAL",`Material ${u} needs at least one layer.`,`Materials[${u}]`);for(let[p,m]of(f.Layers||[]).entries()){let x=`Materials[${u}].Layers[${p}]`;for(let g of wu)if(typeof m[g]=="number")a(m[g],`${x}.${g}`);else if(m[g]?.Keys)for(let y of m[g].Keys)for(let v of y.Vector)a(v,`${x}.${g}`);m.TVertexAnimId!=null&&m.TVertexAnimId!==-1&&!t.TextureAnims?.[m.TVertexAnimId]&&r("error","TEXTURE_ANIM_REFERENCE",`${x} references a missing texture animation.`,x),typeof m.Alpha=="number"&&(m.Alpha<0||m.Alpha>1)&&r("warning","ALPHA_RANGE",`${x} alpha is outside 0\u20131.`,x)}}for(let[u,f]of(t.GeosetAnims||[]).entries())t.Geosets?.[f.GeosetId]||r("error","GEOSET_ANIM_REFERENCE",`Geoset animation ${u} references missing geoset ${f.GeosetId}.`,`GeosetAnims[${u}]`);for(let[u,f]of(t.Gliders||[]).entries())t.Geosets?.[f.GeosetId]||r("error","GLIDER_REFERENCE",`Glider ${u} references missing geoset ${f.GeosetId}.`,`Gliders[${u}]`);for(let u of t.Bones||[])u.GeosetId!=null&&u.GeosetId!==-1&&!t.Geosets?.[u.GeosetId]&&r("error","BONE_GEOSET_REFERENCE",`Bone ${u.Name} references missing geoset ${u.GeosetId}.`,`Nodes[${u.ObjectId}].GeosetId`),u.GeosetAnimId!=null&&u.GeosetAnimId!==-1&&!t.GeosetAnims?.[u.GeosetAnimId]&&r("error","BONE_GEOSET_ANIM_REFERENCE",`Bone ${u.Name} references a missing geoset animation.`,`Nodes[${u.ObjectId}].GeosetAnimId`);for(let u of t.ParticleEmitters2||[])a(u.TextureID,`Nodes[${u.ObjectId}].TextureID`);for(let u of t.RibbonEmitters||[])t.Materials?.[u.MaterialID]||r("error","RIBBON_MATERIAL_REFERENCE",`Ribbon ${u.Name} references a missing material.`,`Nodes[${u.ObjectId}].MaterialID`);for(let[u,f]of(t.Sequences||[]).entries())(!f.Interval||f.Interval.length!==2||f.Interval[0]>=f.Interval[1])&&r("error","SEQUENCE_INTERVAL",`Sequence ${f.Name||u} must end after it starts.`,`Sequences[${u}]`);for(let[u,f]of(t.GlobalSequences||[]).entries())(!Number.isInteger(f)||f<=0)&&r("error","GLOBAL_SEQUENCE_DURATION",`Global sequence ${u} needs a positive integer duration.`,`GlobalSequences[${u}]`);for(let u of t.EventObjects||[])u.GlobalSeqId!=null&&u.GlobalSeqId!==-1&&(!Number.isInteger(u.GlobalSeqId)||u.GlobalSeqId<0||t.GlobalSequences?.[u.GlobalSeqId]===void 0)&&r("error","GLOBAL_SEQUENCE_REFERENCE",`Event ${u.Name} references missing global sequence ${u.GlobalSeqId}.`,`Nodes[${u.ObjectId}].GlobalSeqId`);let c=new Set,h=["Model"],l=()=>h.join(".");function d(u){if(typeof u=="number"){if(!Number.isFinite(u)){let f=l();r("error","NON_FINITE_NUMBER",`${f} contains a non-finite number.`,f)}return}if(!(!u||typeof u!="object"||c.has(u))){if(c.add(u),ArrayBuffer.isView(u)){for(let f=0;f<u.length;f++)if(!Number.isFinite(u[f])){let p=l();r("error","NON_FINITE_NUMBER",`${p} contains a non-finite coordinate.`,p);break}return}if(u.Keys){let f=l();(!Number.isInteger(u.LineType)||u.LineType<0||u.LineType>3)&&r("error","KEYFRAME_INTERPOLATION",`${f} has an invalid interpolation mode.`,f),u.GlobalSeqId!=null&&u.GlobalSeqId!==-1&&t.GlobalSequences?.[u.GlobalSeqId]===void 0&&r("error","GLOBAL_SEQUENCE_REFERENCE",`${f} references missing global sequence ${u.GlobalSeqId}.`,f);let p=-1/0,m=h.at(-1),x=m==="Rotation"?h.includes("Cameras")?1:4:["Translation","Scaling","Color","AmbColor","FresnelColor","TargetTranslation"].includes(m)?3:1;for(let g of u.Keys)(!Number.isInteger(g.Frame)||g.Frame<-2147483648||g.Frame>2147483647||g.Frame<p)&&r("error","KEYFRAME_ORDER",`${f} keyframes must use signed 32-bit integer frames in increasing order.`,f),p=g.Frame,g.Vector?.length?g.Vector.length!==x&&r("error","KEYFRAME_DIMENSIONS",`${f} keyframes need ${x} values.`,f):r("error","KEYFRAME_VECTOR",`${f} has a keyframe without a value.`,f),u.LineType>=2&&(!g.InTan||!g.OutTan||g.InTan.length!==g.Vector?.length||g.OutTan.length!==g.Vector?.length)&&r("error","KEYFRAME_TANGENTS",`${f} spline keyframes need matching in/out tangents.`,f)}for(let f in u)f!=="Nodes"&&Object.prototype.hasOwnProperty.call(u,f)&&(h.push(f),d(u[f]),h.pop())}}if(e){for(let u of Object.keys(t))u!=="Nodes"&&e.has(u)&&(h.push(u),d(t[u]),h.pop());i.push(...n.filter(u=>u.path?.startsWith("Model.")&&!e.has(u.path.split(".")[1])))}else d(t);return i}function Zo(t,e="Bone"){if(!it[e])throw new Error(`Unsupported node type: ${e}.`);if(t.BindPoses?.length)throw new Error("Adding nodes to a model with bind-pose matrices is not supported yet.");let[n,,i]=it[e],r=Math.max(-1,...yr(t).map(a=>a.ObjectId),(t.PivotPoints?.length||0)-1)+1,s=_e(),o={Name:`${e}_${r}`,ObjectId:r,Parent:null,PivotPoint:s,Flags:i};if(e==="Bone"&&Object.assign(o,{GeosetId:null,GeosetAnimId:null}),e==="Attachment"&&Object.assign(o,{AttachmentID:Math.max(-1,...(t.Attachments||[]).map(a=>a.AttachmentID||0))+1,Path:""}),e==="EventObject"&&(o.EventTrack=new Uint32Array([0])),e==="CollisionShape"&&Object.assign(o,{Shape:2,Vertices:_e(),BoundsRadius:16}),e==="Light"&&Object.assign(o,{LightType:0,AttenuationStart:80,AttenuationEnd:200,Color:_e(.2,.8,1),Intensity:1,AmbColor:_e(1,1,1),AmbIntensity:0}),e==="ParticleEmitter2"&&Object.assign(o,{Speed:10,Variation:0,Latitude:20,Gravity:0,LifeSpan:1,EmissionRate:10,Width:4,Length:4,FilterMode:1,Rows:1,Columns:1,FrameFlags:1,TailLength:0,Time:.5,SegmentColor:[_e(.2,.7,1),_e(.3,.9,1),_e(.1,.3,1)],Alpha:new Uint8Array([255,200,0]),ParticleScaling:_e(1,1,0),LifeSpanUVAnim:new Uint32Array([0,0,1]),DecayUVAnim:new Uint32Array([0,0,1]),TailUVAnim:new Uint32Array([0,0,1]),TailDecayUVAnim:new Uint32Array([0,0,1]),TextureID:t.Textures?.length?0:null,ReplaceableId:0,PriorityPlane:0}),e==="RibbonEmitter"){if(!t.Materials?.length)throw new Error("Create a material before adding a ribbon emitter.");Object.assign(o,{HeightAbove:4,HeightBelow:4,Alpha:1,Color:_e(.3,.8,1),LifeSpan:.5,TextureSlot:0,EmissionRate:10,Rows:1,Columns:1,MaterialID:0,Gravity:0})}if(e==="ParticleEmitter"&&Object.assign(o,{EmissionRate:10,Gravity:0,Longitude:0,Latitude:0,Path:"",LifeSpan:1,InitVelocity:0}),e==="ParticleEmitterPopcorn"){if(t.Version<900)throw new Error("Popcorn emitters need a Reforged model version.");Object.assign(o,{LifeSpan:1,EmissionRate:0,Speed:0,Color:_e(1,1,1),Alpha:1,ReplaceableId:0,Path:"",AnimVisibilityGuide:""})}return(t[n]||=[]).push(o),(t.Nodes||=[])[r]=o,(t.PivotPoints||=[])[r]=s,Jo(t),o}function Jo(t){for(let[e,n]of Object.entries({NumGeosets:"Geosets",NumGeosetAnims:"GeosetAnims",NumBones:"Bones",NumHelpers:"Helpers",NumLights:"Lights",NumAttachments:"Attachments",NumEvents:"EventObjects",NumParticleEmitters:"ParticleEmitters",NumParticleEmitters2:"ParticleEmitters2",NumRibbonEmitters:"RibbonEmitters"}))t.Info[e]=t[n]?.length||0}var Du={Float32Array,Float64Array,Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array},Ug=16*1024*1024;function Qo(t){return JSON.stringify(t,(e,n)=>{if(ArrayBuffer.isView(n)){if(!Object.hasOwn(Du,n.constructor.name))throw Error("Unsupported typed array.");return{$array:n.constructor.name,values:Array.from(n)}}if(typeof n=="number"&&!Number.isFinite(n))throw Error("Preset contains a non-finite number.");return n})}function bn(t){if(typeof t!="string"||t.length>260||/[\x00-\x1f]/.test(t))return!1;let e=t.replace(/^(?:[\w.-]+\.w3mod:)+/i,"").replaceAll("\\","/");return!e.startsWith("/")&&!/^[a-z]:/i.test(e)&&!e.split("/").includes("..")}var ea=4*1024*1024;function ta(t){let e=t.embeddedAssets||[];if(!Array.isArray(e)||e.length>64)throw Error("Too many embedded pictures.");let n=0,i=new Set;for(let r of e){if(!r||!bn(r.path)||!/^MDLxL_Forge\\Particle_[a-f0-9]{32}\.(png|blp|dds|tga|jpg|jpeg|webp)$/i.test(r.path)||i.has(r.path.toLowerCase())||typeof r.data!="string"||r.data.length>Math.ceil(ea/3)*4||r.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(r.data))throw Error("Invalid embedded picture.");let s=r.data.length/4*3-(r.data.endsWith("==")?2:r.data.endsWith("=")?1:0);if(!s||s>ea||(n+=s)>8*1024*1024)throw Error("Embedded pictures exceed the portable preset budget.");if(!t.native.Textures.some(o=>o.Image?.toLowerCase()===r.path.toLowerCase()))throw Error("Embedded picture is not a recipe dependency.");i.add(r.path.toLowerCase())}return e}var na=["ParticleEmitters2","RibbonEmitters","ParticleEmitters","ParticleEmitterPopcorns"],ut=t=>structuredClone(t),Uu=["TextureID","NormalTextureID","ORMTextureID","EmissiveTextureID","TeamColorTextureID","ReflectionsTextureID"];function Nu(t=800){let e={Version:t,Info:{Name:"Particle Lab",MinimumExtent:new Float32Array([-64,-64,-16]),MaximumExtent:new Float32Array([64,64,128]),BoundsRadius:120,BlendTime:150},Nodes:[]};for(let n of["Sequences","GlobalSequences","Textures","Materials","TextureAnims","Geosets","GeosetAnims","PivotPoints","Cameras","FaceFX","BindPoses","Gliders",...Object.values(it).map(i=>i[0])])e[n]=[];return e}function bi(t){return na.flatMap(e=>(t[e]||[]).map(n=>({family:e,node:n})))}function Bu(t,e,n,{parent:i=null,sourceInterval:r,targetInterval:s,fit:o=!1}={}){if(t.Version!==e.Version)throw Error("Effect placement requires matching native model versions.");if(e.BindPoses?.length||t.BindPoses?.length)throw Error("Effect placement with bind-pose matrices is not yet supported.");if(i!=null&&!t.Nodes?.[i])throw Error("The attachment node no longer exists.");let a=new Set(n),c=new Set,h=new Set,l=new Map(Object.values(it).flatMap(([x])=>e[x]||[]).map(x=>[x.ObjectId,x]));for(let x of a)if(!bi(e).some(g=>g.node.ObjectId===x))throw Error("Selected effect no longer exists.");function d(x){if(h.has(x))return;if(c.has(x))throw Error("Effect hierarchy contains a cycle.");let g=l.get(x);if(!g)throw Error("Missing effect parent "+x);c.add(x),g.Parent!=null&&g.Parent!==-1&&d(g.Parent),c.delete(x),h.add(x)}n.forEach(d);let u={nodes:new Map,textures:new Map,materials:new Map,textureAnims:new Map,globals:new Map};function f(x){if(!(!x||typeof x!="object"||ArrayBuffer.isView(x))){if(x.GlobalSeqId!=null&&x.GlobalSeqId!==-1){let g=x.GlobalSeqId;if(!u.globals.has(g)){if(!Number.isFinite(e.GlobalSequences[g])||e.GlobalSequences[g]<0)throw Error("Missing global sequence.");u.globals.set(g,t.GlobalSequences.push(e.GlobalSequences[g])-1)}x.GlobalSeqId=u.globals.get(g)}else if(x.Keys&&r&&s){let[g,y]=r,[v,b]=s;if(!(y>g&&b>v))throw Error("Choose valid source and target intervals.");let M=x.Keys.filter(T=>T.Frame>=g&&T.Frame<=y),_=o?(b-v)/(y-g):1;if(x.Keys=M.sort((T,P)=>T.Frame-P.Frame).map(T=>({...T,Frame:Math.round(v+(T.Frame-g)*_)})),x.Keys.some((T,P)=>T.Frame>b||P&&T.Frame<=x.Keys[P-1].Frame))throw Error("The target interval cannot contain these source keys; choose Fit timing or a longer interval.")}for(let g of Object.values(x))f(g)}}function p(x){if(x==null||x===-1)return x;if(!e.Textures[x])throw Error("Missing effect texture "+x);return u.textures.has(x)||u.textures.set(x,t.Textures.push(ut(e.Textures[x]))-1),u.textures.get(x)}function m(x){if(!e.Materials[x])throw Error("Missing ribbon material.");if(!u.materials.has(x)){let g=ut(e.Materials[x]);for(let y of g.Layers||[]){for(let b of Uu){if(typeof y[b]=="number")y[b]=p(y[b]);else if(y[b]?.Keys)for(let M of y[b].Keys)for(let _ of["Vector","InTan","OutTan"])M[_]&&(M[_]=new Int32Array(Array.from(M[_],p)));typeof y._MdxDefaults?.[b]=="number"&&(y._MdxDefaults[b]=p(y._MdxDefaults[b]))}let v=y.TVertexAnimId;if(v!=null&&v!==-1){if(!e.TextureAnims[v])throw Error("Missing texture animation.");if(!u.textureAnims.has(v)){let b=ut(e.TextureAnims[v]);f(b),u.textureAnims.set(v,t.TextureAnims.push(b)-1)}y.TVertexAnimId=u.textureAnims.get(v)}}f(g),u.materials.set(x,t.Materials.push(g)-1)}return u.materials.get(x)}for(let x of h){let g=l.get(x),y=a.has(x)?Object.keys(it).find(_=>e[it[_][0]]?.some(T=>T.ObjectId===x)):"Helper",v=a.has(x)?ut(g):Object.fromEntries(["Name","Flags","Translation","Rotation","Scaling","PivotPoint"].filter(_=>g[_]!==void 0).map(_=>[_,ut(g[_])]));a.has(x)||(v.Flags=(v.Flags||0)&255),y==="ParticleEmitter2"&&(v.TextureID=p(v.TextureID)),y==="RibbonEmitter"&&(v.MaterialID=m(v.MaterialID));let b=Zo(t,y),M=b.ObjectId;u.nodes.set(x,M),Object.assign(b,v,{ObjectId:M,Parent:g.Parent==null||g.Parent===-1?i:u.nodes.get(g.Parent)}),b.PivotPoint=ut(e.PivotPoints[x]||g.PivotPoint||new Float32Array(3)),t.PivotPoints[M]=b.PivotPoint,f(b)}return{ids:n.map(x=>u.nodes.get(x)),maps:u}}function Ou(t,e,n={}){let i=Nu(t.Version);i.Info=ut(t.Info),i.Sequences=ut(t.Sequences||[]);let{ids:r}=Bu(i,t,e),s=bi(i).filter(c=>r.includes(c.node.ObjectId)).map(c=>({id:"ingredient-"+c.node.ObjectId,family:c.family,objectId:c.node.ObjectId})),o=s.filter(c=>["ParticleEmitters","ParticleEmitterPopcorns"].includes(c.family)).map(c=>({id:c.id,reason:c.family==="ParticleEmitters"?"External model emitter preview is not implemented by the pinned renderer.":"Popcorn/HD authoring is outside the classic library."})),a=[...i.Textures.map((c,h)=>({kind:"texture",index:h,path:c.Image,replaceableId:c.ReplaceableId||0})),...i.ParticleEmitters.filter(c=>c.Path).map(c=>({kind:"model",path:c.Path}))];for(let c of a){let h=n.dependencies?.find(l=>l.kind===c.kind&&l.path===c.path);h&&Object.assign(c,ut(h),c.index==null?{}:{index:c.index})}return{schema:"mdlxl-particle-recipe",version:1,id:n.id||"draft",name:n.name||"Particle effect",categories:n.categories||["Other"],tags:n.tags||[],aliases:n.aliases||[],naming:{state:"review-needed"},sources:n.sources||[],...n.grouping?{grouping:ut(n.grouping)}:{},ingredients:s,native:i,dependencies:a,anchor:{position:[0,0,0]},defaultSequence:n.defaultSequence??0,compatibility:{preview:o.length?"incomplete":"unverified",insertion:"unverified",unsupported:o}}}function Vu(t){if(t?.schema!=="mdlxl-particle-recipe"||t.version!==1)throw Error("Unsupported particle preset version.");if(typeof t.name!="string"||!t.name.trim()||t.name.length>120||typeof t.id!="string"||t.id.length>120)throw Error("Invalid preset identity.");if(!t.native||!Array.isArray(t.ingredients)||t.ingredients.length<1||t.ingredients.length>256)throw Error("Invalid effect ingredients.");let e=t.native;if((e.Nodes?.length||0)>1e4||(e.Textures?.length||0)>1024||(e.Sequences?.length||0)>2048)throw Error("Preset exceeds native resource limits.");let n=Object.values(it).flatMap(([o])=>e[o]||[]);if(n.length>1e4||n.some(o=>!Number.isInteger(o.ObjectId)||o.ObjectId<0||o.ObjectId>1e4))throw Error("Preset exceeds node identity limits.");let i=bi(e);if(i.length!==t.ingredients.length||new Set(t.ingredients.map(o=>o.objectId)).size!==i.length)throw Error("Every native effect needs one ingredient identity.");let r=o=>{if(typeof o=="number"&&(!Number.isFinite(o)||Math.abs(o)>34028234663852886e22))throw Error("Preset exceeds finite native numeric values.");if(o&&typeof o=="object")for(let a of Object.values(o))r(a)};r(e);for(let o of t.dependencies||[])if(o.path&&!bn(o.path))throw Error("Preset dependency needs a portable logical path.");for(let o of e.Textures||[])if(o.Image&&!bn(o.Image))throw Error("Invalid texture dependency path.");for(let o of[...e.ParticleEmitters||[],...e.ParticleEmitterPopcorns||[]])if(o.Path&&!bn(o.Path))throw Error("Invalid external effect path.");for(let o of t.ingredients)if(!na.includes(o.family)||!e[o.family]?.some(a=>a.ObjectId===o.objectId))throw Error("Missing native ingredient.");ta(t);let s=Nt(e).filter(o=>o.severity==="error");if(s.length)throw Error(s.slice(0,3).map(o=>o.message).join(`
`));return Qo(t),t}var pa=1;var ma=3;var wr=0,Pr=1,Cr=2,Rr=3,Ir=4,Lr=5,Fr=6,Dr=7,ga=0,va=1,xa=2;var $r=1,Yr=2,Kr=3,jr=4,Zr=5,Jr=6,Qr=7;var es=300,ya=301,ts=302;var _a=306,Ur=1e3,Wn=1001,Nr=1002;var ba=1006;var Sa=1008;var Ma=1009;var Ta=1023;var qn=2300,Pi=2301,Ei=2302,Br=2303,Or=2400,Vr=2401,Gr=2402;var ns="",Ye="srgb",kr="srgb-linear",zr="linear",wi="srgb";var Xn=2e3,Hr=2001;function Gu(t){return ArrayBuffer.isView(t)&&!(t instanceof DataView)}function Wr(t){return document.createElementNS("http://www.w3.org/1999/xhtml",t)}var ia={},Ci=null;function Aa(t){let e=t[0];if(typeof e=="string"&&e.startsWith("TSL:")){let n=t[1];n&&n.isStackTrace?t[0]+=" "+n.getLocation():t[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return t}function Ae(...t){t=Aa(t);let e="THREE."+t.shift();if(Ci)Ci("warn",e,...t);else{let n=t[0];n&&n.isStackTrace?console.warn(n.getError(e)):console.warn(e,...t)}}function xe(...t){t=Aa(t);let e="THREE."+t.shift();if(Ci)Ci("error",e,...t);else{let n=t[0];n&&n.isStackTrace?console.error(n.getError(e)):console.error(e,...t)}}function Xr(...t){let e=t.join(" ");e in ia||(ia[e]=!0,Ae(...t))}var ku={[wr]:Pr,[Cr]:Fr,[Ir]:Dr,[Rr]:Lr,[Pr]:wr,[Fr]:Cr,[Dr]:Ir,[Lr]:Rr},$n=class{addEventListener(e,n){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(n)===-1&&i[e].push(n)}hasEventListener(e,n){let i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(n)!==-1}removeEventListener(e,n){let i=this._listeners;if(i===void 0)return;let r=i[e];if(r!==void 0){let s=r.indexOf(n);s!==-1&&r.splice(s,1)}}dispatchEvent(e){let n=this._listeners;if(n===void 0)return;let i=n[e.type];if(i!==void 0){e.target=this;let r=i.slice(0);for(let s=0,o=r.length;s<o;s++)r[s].call(this,e);e.target=null}}},Me=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var Wg=Math.PI/180,zu=180/Math.PI;function is(){let t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Me[t&255]+Me[t>>8&255]+Me[t>>16&255]+Me[t>>24&255]+"-"+Me[e&255]+Me[e>>8&255]+"-"+Me[e>>16&15|64]+Me[e>>24&255]+"-"+Me[n&63|128]+Me[n>>8&255]+"-"+Me[n>>16&255]+Me[n>>24&255]+Me[i&255]+Me[i>>8&255]+Me[i>>16&255]+Me[i>>24&255]).toLowerCase()}function ee(t,e,n){return Math.max(e,Math.min(n,t))}function Hu(t,e){return(t%e+e)%e}function _r(t,e,n){return(1-n)*t+n*e}var st=class t{constructor(e=0,n=0){t.prototype.isVector2=!0,this.x=e,this.y=n}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,n){return this.x=e,this.y=n,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,n){switch(e){case 0:this.x=n;break;case 1:this.y=n;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,n){return this.x=e.x+n.x,this.y=e.y+n.y,this}addScaledVector(e,n){return this.x+=e.x*n,this.y+=e.y*n,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,n){return this.x=e.x-n.x,this.y=e.y-n.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let n=this.x,i=this.y,r=e.elements;return this.x=r[0]*n+r[3]*i+r[6],this.y=r[1]*n+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,n){return this.x=ee(this.x,e.x,n.x),this.y=ee(this.y,e.y,n.y),this}clampScalar(e,n){return this.x=ee(this.x,e,n),this.y=ee(this.y,e,n),this}clampLength(e,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar(ee(i,e,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let n=Math.sqrt(this.lengthSq()*e.lengthSq());if(n===0)return Math.PI/2;let i=this.dot(e)/n;return Math.acos(ee(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let n=this.x-e.x,i=this.y-e.y;return n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,n){return this.x+=(e.x-this.x)*n,this.y+=(e.y-this.y)*n,this}lerpVectors(e,n,i){return this.x=e.x+(n.x-e.x)*i,this.y=e.y+(n.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,n=0){return this.x=e[n],this.y=e[n+1],this}toArray(e=[],n=0){return e[n]=this.x,e[n+1]=this.y,e}fromBufferAttribute(e,n){return this.x=e.getX(n),this.y=e.getY(n),this}rotateAround(e,n){let i=Math.cos(n),r=Math.sin(n),s=this.x-e.x,o=this.y-e.y;return this.x=s*i-o*r+e.x,this.y=s*r+o*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Oe=class{constructor(e=0,n=0,i=0,r=1){this.isQuaternion=!0,this._x=e,this._y=n,this._z=i,this._w=r}static slerpFlat(e,n,i,r,s,o,a){let c=i[r+0],h=i[r+1],l=i[r+2],d=i[r+3],u=s[o+0],f=s[o+1],p=s[o+2],m=s[o+3];if(d!==m||c!==u||h!==f||l!==p){let x=c*u+h*f+l*p+d*m;x<0&&(u=-u,f=-f,p=-p,m=-m,x=-x);let g=1-a;if(x<.9995){let y=Math.acos(x),v=Math.sin(y);g=Math.sin(g*y)/v,a=Math.sin(a*y)/v,c=c*g+u*a,h=h*g+f*a,l=l*g+p*a,d=d*g+m*a}else{c=c*g+u*a,h=h*g+f*a,l=l*g+p*a,d=d*g+m*a;let y=1/Math.sqrt(c*c+h*h+l*l+d*d);c*=y,h*=y,l*=y,d*=y}}e[n]=c,e[n+1]=h,e[n+2]=l,e[n+3]=d}static multiplyQuaternionsFlat(e,n,i,r,s,o){let a=i[r],c=i[r+1],h=i[r+2],l=i[r+3],d=s[o],u=s[o+1],f=s[o+2],p=s[o+3];return e[n]=a*p+l*d+c*f-h*u,e[n+1]=c*p+l*u+h*d-a*f,e[n+2]=h*p+l*f+a*u-c*d,e[n+3]=l*p-a*d-c*u-h*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,n,i,r){return this._x=e,this._y=n,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,n=!0){let i=e._x,r=e._y,s=e._z,o=e._order,a=Math.cos,c=Math.sin,h=a(i/2),l=a(r/2),d=a(s/2),u=c(i/2),f=c(r/2),p=c(s/2);switch(o){case"XYZ":this._x=u*l*d+h*f*p,this._y=h*f*d-u*l*p,this._z=h*l*p+u*f*d,this._w=h*l*d-u*f*p;break;case"YXZ":this._x=u*l*d+h*f*p,this._y=h*f*d-u*l*p,this._z=h*l*p-u*f*d,this._w=h*l*d+u*f*p;break;case"ZXY":this._x=u*l*d-h*f*p,this._y=h*f*d+u*l*p,this._z=h*l*p+u*f*d,this._w=h*l*d-u*f*p;break;case"ZYX":this._x=u*l*d-h*f*p,this._y=h*f*d+u*l*p,this._z=h*l*p-u*f*d,this._w=h*l*d+u*f*p;break;case"YZX":this._x=u*l*d+h*f*p,this._y=h*f*d+u*l*p,this._z=h*l*p-u*f*d,this._w=h*l*d-u*f*p;break;case"XZY":this._x=u*l*d-h*f*p,this._y=h*f*d-u*l*p,this._z=h*l*p+u*f*d,this._w=h*l*d+u*f*p;break;default:Ae("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return n===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,n){let i=n/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){let n=e.elements,i=n[0],r=n[4],s=n[8],o=n[1],a=n[5],c=n[9],h=n[2],l=n[6],d=n[10],u=i+a+d;if(u>0){let f=.5/Math.sqrt(u+1);this._w=.25/f,this._x=(l-c)*f,this._y=(s-h)*f,this._z=(o-r)*f}else if(i>a&&i>d){let f=2*Math.sqrt(1+i-a-d);this._w=(l-c)/f,this._x=.25*f,this._y=(r+o)/f,this._z=(s+h)/f}else if(a>d){let f=2*Math.sqrt(1+a-i-d);this._w=(s-h)/f,this._x=(r+o)/f,this._y=.25*f,this._z=(c+l)/f}else{let f=2*Math.sqrt(1+d-i-a);this._w=(o-r)/f,this._x=(s+h)/f,this._y=(c+l)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,n){let i=e.dot(n)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*n.z-e.z*n.y,this._y=e.z*n.x-e.x*n.z,this._z=e.x*n.y-e.y*n.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(ee(this.dot(e),-1,1)))}rotateTowards(e,n){let i=this.angleTo(e);if(i===0)return this;let r=Math.min(1,n/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,n){let i=e._x,r=e._y,s=e._z,o=e._w,a=n._x,c=n._y,h=n._z,l=n._w;return this._x=i*l+o*a+r*h-s*c,this._y=r*l+o*c+s*a-i*h,this._z=s*l+o*h+i*c-r*a,this._w=o*l-i*a-r*c-s*h,this._onChangeCallback(),this}slerp(e,n){let i=e._x,r=e._y,s=e._z,o=e._w,a=this.dot(e);a<0&&(i=-i,r=-r,s=-s,o=-o,a=-a);let c=1-n;if(a<.9995){let h=Math.acos(a),l=Math.sin(h);c=Math.sin(c*h)/l,n=Math.sin(n*h)/l,this._x=this._x*c+i*n,this._y=this._y*c+r*n,this._z=this._z*c+s*n,this._w=this._w*c+o*n,this._onChangeCallback()}else this._x=this._x*c+i*n,this._y=this._y*c+r*n,this._z=this._z*c+s*n,this._w=this._w*c+o*n,this.normalize();return this}slerpQuaternions(e,n,i){return this.copy(e).slerp(n,i)}random(){let e=2*Math.PI*Math.random(),n=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(n),s*Math.cos(n))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,n=0){return this._x=e[n],this._y=e[n+1],this._z=e[n+2],this._w=e[n+3],this._onChangeCallback(),this}toArray(e=[],n=0){return e[n]=this._x,e[n+1]=this._y,e[n+2]=this._z,e[n+3]=this._w,e}fromBufferAttribute(e,n){return this._x=e.getX(n),this._y=e.getY(n),this._z=e.getZ(n),this._w=e.getW(n),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},le=class t{constructor(e=0,n=0,i=0){t.prototype.isVector3=!0,this.x=e,this.y=n,this.z=i}set(e,n,i){return i===void 0&&(i=this.z),this.x=e,this.y=n,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,n){switch(e){case 0:this.x=n;break;case 1:this.y=n;break;case 2:this.z=n;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,n){return this.x=e.x+n.x,this.y=e.y+n.y,this.z=e.z+n.z,this}addScaledVector(e,n){return this.x+=e.x*n,this.y+=e.y*n,this.z+=e.z*n,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,n){return this.x=e.x-n.x,this.y=e.y-n.y,this.z=e.z-n.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,n){return this.x=e.x*n.x,this.y=e.y*n.y,this.z=e.z*n.z,this}applyEuler(e){return this.applyQuaternion(ra.setFromEuler(e))}applyAxisAngle(e,n){return this.applyQuaternion(ra.setFromAxisAngle(e,n))}applyMatrix3(e){let n=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*n+s[3]*i+s[6]*r,this.y=s[1]*n+s[4]*i+s[7]*r,this.z=s[2]*n+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let n=this.x,i=this.y,r=this.z,s=e.elements,o=1/(s[3]*n+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*n+s[4]*i+s[8]*r+s[12])*o,this.y=(s[1]*n+s[5]*i+s[9]*r+s[13])*o,this.z=(s[2]*n+s[6]*i+s[10]*r+s[14])*o,this}applyQuaternion(e){let n=this.x,i=this.y,r=this.z,s=e.x,o=e.y,a=e.z,c=e.w,h=2*(o*r-a*i),l=2*(a*n-s*r),d=2*(s*i-o*n);return this.x=n+c*h+o*d-a*l,this.y=i+c*l+a*h-s*d,this.z=r+c*d+s*l-o*h,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let n=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*n+s[4]*i+s[8]*r,this.y=s[1]*n+s[5]*i+s[9]*r,this.z=s[2]*n+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,n){return this.x=ee(this.x,e.x,n.x),this.y=ee(this.y,e.y,n.y),this.z=ee(this.z,e.z,n.z),this}clampScalar(e,n){return this.x=ee(this.x,e,n),this.y=ee(this.y,e,n),this.z=ee(this.z,e,n),this}clampLength(e,n){let i=this.length();return this.divideScalar(i||1).multiplyScalar(ee(i,e,n))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,n){return this.x+=(e.x-this.x)*n,this.y+=(e.y-this.y)*n,this.z+=(e.z-this.z)*n,this}lerpVectors(e,n,i){return this.x=e.x+(n.x-e.x)*i,this.y=e.y+(n.y-e.y)*i,this.z=e.z+(n.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,n){let i=e.x,r=e.y,s=e.z,o=n.x,a=n.y,c=n.z;return this.x=r*c-s*a,this.y=s*o-i*c,this.z=i*a-r*o,this}projectOnVector(e){let n=e.lengthSq();if(n===0)return this.set(0,0,0);let i=e.dot(this)/n;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return br.copy(this).projectOnVector(e),this.sub(br)}reflect(e){return this.sub(br.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let n=Math.sqrt(this.lengthSq()*e.lengthSq());if(n===0)return Math.PI/2;let i=this.dot(e)/n;return Math.acos(ee(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let n=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return n*n+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,n,i){let r=Math.sin(n)*e;return this.x=r*Math.sin(i),this.y=Math.cos(n)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,n,i){return this.x=e*Math.sin(n),this.y=i,this.z=e*Math.cos(n),this}setFromMatrixPosition(e){let n=e.elements;return this.x=n[12],this.y=n[13],this.z=n[14],this}setFromMatrixScale(e){let n=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=n,this.y=i,this.z=r,this}setFromMatrixColumn(e,n){return this.fromArray(e.elements,n*4)}setFromMatrix3Column(e,n){return this.fromArray(e.elements,n*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,n=0){return this.x=e[n],this.y=e[n+1],this.z=e[n+2],this}toArray(e=[],n=0){return e[n]=this.x,e[n+1]=this.y,e[n+2]=this.z,e}fromBufferAttribute(e,n){return this.x=e.getX(n),this.y=e.getY(n),this.z=e.getZ(n),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,n=Math.random()*2-1,i=Math.sqrt(1-n*n);return this.x=i*Math.cos(e),this.y=n,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},br=new le,ra=new Oe,$=class t{constructor(e,n,i,r,s,o,a,c,h){t.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,n,i,r,s,o,a,c,h)}set(e,n,i,r,s,o,a,c,h){let l=this.elements;return l[0]=e,l[1]=r,l[2]=a,l[3]=n,l[4]=s,l[5]=c,l[6]=i,l[7]=o,l[8]=h,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let n=this.elements,i=e.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],this}extractBasis(e,n,i){return e.setFromMatrix3Column(this,0),n.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let n=e.elements;return this.set(n[0],n[4],n[8],n[1],n[5],n[9],n[2],n[6],n[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,n){let i=e.elements,r=n.elements,s=this.elements,o=i[0],a=i[3],c=i[6],h=i[1],l=i[4],d=i[7],u=i[2],f=i[5],p=i[8],m=r[0],x=r[3],g=r[6],y=r[1],v=r[4],b=r[7],M=r[2],_=r[5],T=r[8];return s[0]=o*m+a*y+c*M,s[3]=o*x+a*v+c*_,s[6]=o*g+a*b+c*T,s[1]=h*m+l*y+d*M,s[4]=h*x+l*v+d*_,s[7]=h*g+l*b+d*T,s[2]=u*m+f*y+p*M,s[5]=u*x+f*v+p*_,s[8]=u*g+f*b+p*T,this}multiplyScalar(e){let n=this.elements;return n[0]*=e,n[3]*=e,n[6]*=e,n[1]*=e,n[4]*=e,n[7]*=e,n[2]*=e,n[5]*=e,n[8]*=e,this}determinant(){let e=this.elements,n=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],c=e[6],h=e[7],l=e[8];return n*o*l-n*a*h-i*s*l+i*a*c+r*s*h-r*o*c}invert(){let e=this.elements,n=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],c=e[6],h=e[7],l=e[8],d=l*o-a*h,u=a*c-l*s,f=h*s-o*c,p=n*d+i*u+r*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let m=1/p;return e[0]=d*m,e[1]=(r*h-l*i)*m,e[2]=(a*i-r*o)*m,e[3]=u*m,e[4]=(l*n-r*c)*m,e[5]=(r*s-a*n)*m,e[6]=f*m,e[7]=(i*c-h*n)*m,e[8]=(o*n-i*s)*m,this}transpose(){let e,n=this.elements;return e=n[1],n[1]=n[3],n[3]=e,e=n[2],n[2]=n[6],n[6]=e,e=n[5],n[5]=n[7],n[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let n=this.elements;return e[0]=n[0],e[1]=n[3],e[2]=n[6],e[3]=n[1],e[4]=n[4],e[5]=n[7],e[6]=n[2],e[7]=n[5],e[8]=n[8],this}setUvTransform(e,n,i,r,s,o,a){let c=Math.cos(s),h=Math.sin(s);return this.set(i*c,i*h,-i*(c*o+h*a)+o+e,-r*h,r*c,-r*(-h*o+c*a)+a+n,0,0,1),this}scale(e,n){return this.premultiply(Sr.makeScale(e,n)),this}rotate(e){return this.premultiply(Sr.makeRotation(-e)),this}translate(e,n){return this.premultiply(Sr.makeTranslation(e,n)),this}makeTranslation(e,n){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,n,0,0,1),this}makeRotation(e){let n=Math.cos(e),i=Math.sin(e);return this.set(n,-i,0,i,n,0,0,0,1),this}makeScale(e,n){return this.set(e,0,0,0,n,0,0,0,1),this}equals(e){let n=this.elements,i=e.elements;for(let r=0;r<9;r++)if(n[r]!==i[r])return!1;return!0}fromArray(e,n=0){for(let i=0;i<9;i++)this.elements[i]=e[i+n];return this}toArray(e=[],n=0){let i=this.elements;return e[n]=i[0],e[n+1]=i[1],e[n+2]=i[2],e[n+3]=i[3],e[n+4]=i[4],e[n+5]=i[5],e[n+6]=i[6],e[n+7]=i[7],e[n+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}},Sr=new $,sa=new $().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),oa=new $().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Wu(){let t={enabled:!0,workingColorSpace:kr,spaces:{},convert:function(r,s,o){return this.enabled===!1||s===o||!s||!o||(this.spaces[s].transfer===wi&&(r.r=Mt(r.r),r.g=Mt(r.g),r.b=Mt(r.b)),this.spaces[s].primaries!==this.spaces[o].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===wi&&(r.r=En(r.r),r.g=En(r.g),r.b=En(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===ns?zr:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,o){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return Xr("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),t.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return Xr("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),t.colorSpaceToWorking(r,s)}},e=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],i=[.3127,.329];return t.define({[kr]:{primaries:e,whitePoint:i,transfer:zr,toXYZ:sa,fromXYZ:oa,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:Ye},outputColorSpaceConfig:{drawingBufferColorSpace:Ye}},[Ye]:{primaries:e,whitePoint:i,transfer:wi,toXYZ:sa,fromXYZ:oa,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:Ye}}}),t}var $e=Wu();function Mt(t){return t<.04045?t*.0773993808:Math.pow(t*.9478672986+.0521327014,2.4)}function En(t){return t<.0031308?t*12.92:1.055*Math.pow(t,.41666)-.055}var Sn,Ri=class{static getDataURL(e,n="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{Sn===void 0&&(Sn=Wr("canvas")),Sn.width=e.width,Sn.height=e.height;let r=Sn.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),i=Sn}return i.toDataURL(n)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let n=Wr("canvas");n.width=e.width,n.height=e.height;let i=n.getContext("2d");i.drawImage(e,0,0,e.width,e.height);let r=i.getImageData(0,0,e.width,e.height),s=r.data;for(let o=0;o<s.length;o++)s[o]=Mt(s[o]/255)*255;return i.putImageData(r,0,0),n}else if(e.data){let n=e.data.slice(0);for(let i=0;i<n.length;i++)n instanceof Uint8Array||n instanceof Uint8ClampedArray?n[i]=Math.floor(Mt(n[i]/255)*255):n[i]=Mt(n[i]);return{data:n,width:e.width,height:e.height}}else return Ae("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},Xu=0,Ii=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Xu++}),this.uuid=is(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let n=this.data;return typeof HTMLVideoElement<"u"&&n instanceof HTMLVideoElement?e.set(n.videoWidth,n.videoHeight,0):typeof VideoFrame<"u"&&n instanceof VideoFrame?e.set(n.displayHeight,n.displayWidth,0):n!==null?e.set(n.width,n.height,n.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let n=e===void 0||typeof e=="string";if(!n&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(Mr(r[o].image)):s.push(Mr(r[o]))}else s=Mr(r);i.url=s}return n||(e.images[this.uuid]=i),i}};function Mr(t){return typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap?Ri.getDataURL(t):t.data?{data:Array.from(t.data),width:t.width,height:t.height,type:t.data.constructor.name}:(Ae("Texture: Unable to serialize Texture."),{})}var qu=0,Tr=new le,wn=class t extends $n{constructor(e=t.DEFAULT_IMAGE,n=t.DEFAULT_MAPPING,i=Wn,r=Wn,s=ba,o=Sa,a=Ta,c=Ma,h=t.DEFAULT_ANISOTROPY,l=ns){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:qu++}),this.uuid=is(),this.name="",this.source=new Ii(e),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=h,this.format=a,this.internalFormat=null,this.type=c,this.offset=new st(0,0),this.repeat=new st(1,1),this.center=new st(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new $,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=l,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(Tr).x}get height(){return this.source.getSize(Tr).y}get depth(){return this.source.getSize(Tr).z}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,n){this.updateRanges.push({start:e,count:n})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let n in e){let i=e[n];if(i===void 0){Ae(`Texture.setValues(): parameter '${n}' has value of undefined.`);continue}let r=this[n];if(r===void 0){Ae(`Texture.setValues(): property '${n}' does not exist.`);continue}r&&i&&r.isVector2&&i.isVector2||r&&i&&r.isVector3&&i.isVector3||r&&i&&r.isMatrix3&&i.isMatrix3?r.copy(i):this[n]=i}}toJSON(e){let n=e===void 0||typeof e=="string";if(!n&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),n||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==es)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Ur:e.x=e.x-Math.floor(e.x);break;case Wn:e.x=e.x<0?0:1;break;case Nr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Ur:e.y=e.y-Math.floor(e.y);break;case Wn:e.y=e.y<0?0:1;break;case Nr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};wn.DEFAULT_IMAGE=null;wn.DEFAULT_MAPPING=es;wn.DEFAULT_ANISOTROPY=1;var ft=class t{constructor(e,n,i,r,s,o,a,c,h,l,d,u,f,p,m,x){t.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,n,i,r,s,o,a,c,h,l,d,u,f,p,m,x)}set(e,n,i,r,s,o,a,c,h,l,d,u,f,p,m,x){let g=this.elements;return g[0]=e,g[4]=n,g[8]=i,g[12]=r,g[1]=s,g[5]=o,g[9]=a,g[13]=c,g[2]=h,g[6]=l,g[10]=d,g[14]=u,g[3]=f,g[7]=p,g[11]=m,g[15]=x,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new t().fromArray(this.elements)}copy(e){let n=this.elements,i=e.elements;return n[0]=i[0],n[1]=i[1],n[2]=i[2],n[3]=i[3],n[4]=i[4],n[5]=i[5],n[6]=i[6],n[7]=i[7],n[8]=i[8],n[9]=i[9],n[10]=i[10],n[11]=i[11],n[12]=i[12],n[13]=i[13],n[14]=i[14],n[15]=i[15],this}copyPosition(e){let n=this.elements,i=e.elements;return n[12]=i[12],n[13]=i[13],n[14]=i[14],this}setFromMatrix3(e){let n=e.elements;return this.set(n[0],n[3],n[6],0,n[1],n[4],n[7],0,n[2],n[5],n[8],0,0,0,0,1),this}extractBasis(e,n,i){return this.determinant()===0?(e.set(1,0,0),n.set(0,1,0),i.set(0,0,1),this):(e.setFromMatrixColumn(this,0),n.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(e,n,i){return this.set(e.x,n.x,i.x,0,e.y,n.y,i.y,0,e.z,n.z,i.z,0,0,0,0,1),this}extractRotation(e){if(e.determinant()===0)return this.identity();let n=this.elements,i=e.elements,r=1/Mn.setFromMatrixColumn(e,0).length(),s=1/Mn.setFromMatrixColumn(e,1).length(),o=1/Mn.setFromMatrixColumn(e,2).length();return n[0]=i[0]*r,n[1]=i[1]*r,n[2]=i[2]*r,n[3]=0,n[4]=i[4]*s,n[5]=i[5]*s,n[6]=i[6]*s,n[7]=0,n[8]=i[8]*o,n[9]=i[9]*o,n[10]=i[10]*o,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromEuler(e){let n=this.elements,i=e.x,r=e.y,s=e.z,o=Math.cos(i),a=Math.sin(i),c=Math.cos(r),h=Math.sin(r),l=Math.cos(s),d=Math.sin(s);if(e.order==="XYZ"){let u=o*l,f=o*d,p=a*l,m=a*d;n[0]=c*l,n[4]=-c*d,n[8]=h,n[1]=f+p*h,n[5]=u-m*h,n[9]=-a*c,n[2]=m-u*h,n[6]=p+f*h,n[10]=o*c}else if(e.order==="YXZ"){let u=c*l,f=c*d,p=h*l,m=h*d;n[0]=u+m*a,n[4]=p*a-f,n[8]=o*h,n[1]=o*d,n[5]=o*l,n[9]=-a,n[2]=f*a-p,n[6]=m+u*a,n[10]=o*c}else if(e.order==="ZXY"){let u=c*l,f=c*d,p=h*l,m=h*d;n[0]=u-m*a,n[4]=-o*d,n[8]=p+f*a,n[1]=f+p*a,n[5]=o*l,n[9]=m-u*a,n[2]=-o*h,n[6]=a,n[10]=o*c}else if(e.order==="ZYX"){let u=o*l,f=o*d,p=a*l,m=a*d;n[0]=c*l,n[4]=p*h-f,n[8]=u*h+m,n[1]=c*d,n[5]=m*h+u,n[9]=f*h-p,n[2]=-h,n[6]=a*c,n[10]=o*c}else if(e.order==="YZX"){let u=o*c,f=o*h,p=a*c,m=a*h;n[0]=c*l,n[4]=m-u*d,n[8]=p*d+f,n[1]=d,n[5]=o*l,n[9]=-a*l,n[2]=-h*l,n[6]=f*d+p,n[10]=u-m*d}else if(e.order==="XZY"){let u=o*c,f=o*h,p=a*c,m=a*h;n[0]=c*l,n[4]=-d,n[8]=h*l,n[1]=u*d+m,n[5]=o*l,n[9]=f*d-p,n[2]=p*d-f,n[6]=a*l,n[10]=m*d+u}return n[3]=0,n[7]=0,n[11]=0,n[12]=0,n[13]=0,n[14]=0,n[15]=1,this}makeRotationFromQuaternion(e){return this.compose($u,e,Yu)}lookAt(e,n,i){let r=this.elements;return ze.subVectors(e,n),ze.lengthSq()===0&&(ze.z=1),ze.normalize(),Bt.crossVectors(i,ze),Bt.lengthSq()===0&&(Math.abs(i.z)===1?ze.x+=1e-4:ze.z+=1e-4,ze.normalize(),Bt.crossVectors(i,ze)),Bt.normalize(),Si.crossVectors(ze,Bt),r[0]=Bt.x,r[4]=Si.x,r[8]=ze.x,r[1]=Bt.y,r[5]=Si.y,r[9]=ze.y,r[2]=Bt.z,r[6]=Si.z,r[10]=ze.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,n){let i=e.elements,r=n.elements,s=this.elements,o=i[0],a=i[4],c=i[8],h=i[12],l=i[1],d=i[5],u=i[9],f=i[13],p=i[2],m=i[6],x=i[10],g=i[14],y=i[3],v=i[7],b=i[11],M=i[15],_=r[0],T=r[4],P=r[8],A=r[12],O=r[1],N=r[5],F=r[9],C=r[13],D=r[2],w=r[6],R=r[10],oe=r[14],U=r[3],Ke=r[7],Ee=r[11],we=r[15];return s[0]=o*_+a*O+c*D+h*U,s[4]=o*T+a*N+c*w+h*Ke,s[8]=o*P+a*F+c*R+h*Ee,s[12]=o*A+a*C+c*oe+h*we,s[1]=l*_+d*O+u*D+f*U,s[5]=l*T+d*N+u*w+f*Ke,s[9]=l*P+d*F+u*R+f*Ee,s[13]=l*A+d*C+u*oe+f*we,s[2]=p*_+m*O+x*D+g*U,s[6]=p*T+m*N+x*w+g*Ke,s[10]=p*P+m*F+x*R+g*Ee,s[14]=p*A+m*C+x*oe+g*we,s[3]=y*_+v*O+b*D+M*U,s[7]=y*T+v*N+b*w+M*Ke,s[11]=y*P+v*F+b*R+M*Ee,s[15]=y*A+v*C+b*oe+M*we,this}multiplyScalar(e){let n=this.elements;return n[0]*=e,n[4]*=e,n[8]*=e,n[12]*=e,n[1]*=e,n[5]*=e,n[9]*=e,n[13]*=e,n[2]*=e,n[6]*=e,n[10]*=e,n[14]*=e,n[3]*=e,n[7]*=e,n[11]*=e,n[15]*=e,this}determinant(){let e=this.elements,n=e[0],i=e[4],r=e[8],s=e[12],o=e[1],a=e[5],c=e[9],h=e[13],l=e[2],d=e[6],u=e[10],f=e[14],p=e[3],m=e[7],x=e[11],g=e[15],y=c*f-h*u,v=a*f-h*d,b=a*u-c*d,M=o*f-h*l,_=o*u-c*l,T=o*d-a*l;return n*(m*y-x*v+g*b)-i*(p*y-x*M+g*_)+r*(p*v-m*M+g*T)-s*(p*b-m*_+x*T)}transpose(){let e=this.elements,n;return n=e[1],e[1]=e[4],e[4]=n,n=e[2],e[2]=e[8],e[8]=n,n=e[6],e[6]=e[9],e[9]=n,n=e[3],e[3]=e[12],e[12]=n,n=e[7],e[7]=e[13],e[13]=n,n=e[11],e[11]=e[14],e[14]=n,this}setPosition(e,n,i){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=n,r[14]=i),this}invert(){let e=this.elements,n=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],c=e[6],h=e[7],l=e[8],d=e[9],u=e[10],f=e[11],p=e[12],m=e[13],x=e[14],g=e[15],y=n*a-i*o,v=n*c-r*o,b=n*h-s*o,M=i*c-r*a,_=i*h-s*a,T=r*h-s*c,P=l*m-d*p,A=l*x-u*p,O=l*g-f*p,N=d*x-u*m,F=d*g-f*m,C=u*g-f*x,D=y*C-v*F+b*N+M*O-_*A+T*P;if(D===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let w=1/D;return e[0]=(a*C-c*F+h*N)*w,e[1]=(r*F-i*C-s*N)*w,e[2]=(m*T-x*_+g*M)*w,e[3]=(u*_-d*T-f*M)*w,e[4]=(c*O-o*C-h*A)*w,e[5]=(n*C-r*O+s*A)*w,e[6]=(x*b-p*T-g*v)*w,e[7]=(l*T-u*b+f*v)*w,e[8]=(o*F-a*O+h*P)*w,e[9]=(i*O-n*F-s*P)*w,e[10]=(p*_-m*b+g*y)*w,e[11]=(d*b-l*_-f*y)*w,e[12]=(a*A-o*N-c*P)*w,e[13]=(n*N-i*A+r*P)*w,e[14]=(m*v-p*M-x*y)*w,e[15]=(l*M-d*v+u*y)*w,this}scale(e){let n=this.elements,i=e.x,r=e.y,s=e.z;return n[0]*=i,n[4]*=r,n[8]*=s,n[1]*=i,n[5]*=r,n[9]*=s,n[2]*=i,n[6]*=r,n[10]*=s,n[3]*=i,n[7]*=r,n[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,n=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(n,i,r))}makeTranslation(e,n,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,n,0,0,1,i,0,0,0,1),this}makeRotationX(e){let n=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,n,-i,0,0,i,n,0,0,0,0,1),this}makeRotationY(e){let n=Math.cos(e),i=Math.sin(e);return this.set(n,0,i,0,0,1,0,0,-i,0,n,0,0,0,0,1),this}makeRotationZ(e){let n=Math.cos(e),i=Math.sin(e);return this.set(n,-i,0,0,i,n,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,n){let i=Math.cos(n),r=Math.sin(n),s=1-i,o=e.x,a=e.y,c=e.z,h=s*o,l=s*a;return this.set(h*o+i,h*a-r*c,h*c+r*a,0,h*a+r*c,l*a+i,l*c-r*o,0,h*c-r*a,l*c+r*o,s*c*c+i,0,0,0,0,1),this}makeScale(e,n,i){return this.set(e,0,0,0,0,n,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,n,i,r,s,o){return this.set(1,i,s,0,e,1,o,0,n,r,1,0,0,0,0,1),this}compose(e,n,i){let r=this.elements,s=n._x,o=n._y,a=n._z,c=n._w,h=s+s,l=o+o,d=a+a,u=s*h,f=s*l,p=s*d,m=o*l,x=o*d,g=a*d,y=c*h,v=c*l,b=c*d,M=i.x,_=i.y,T=i.z;return r[0]=(1-(m+g))*M,r[1]=(f+b)*M,r[2]=(p-v)*M,r[3]=0,r[4]=(f-b)*_,r[5]=(1-(u+g))*_,r[6]=(x+y)*_,r[7]=0,r[8]=(p+v)*T,r[9]=(x-y)*T,r[10]=(1-(u+m))*T,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,n,i){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let s=this.determinant();if(s===0)return i.set(1,1,1),n.identity(),this;let o=Mn.set(r[0],r[1],r[2]).length(),a=Mn.set(r[4],r[5],r[6]).length(),c=Mn.set(r[8],r[9],r[10]).length();s<0&&(o=-o),rt.copy(this);let h=1/o,l=1/a,d=1/c;return rt.elements[0]*=h,rt.elements[1]*=h,rt.elements[2]*=h,rt.elements[4]*=l,rt.elements[5]*=l,rt.elements[6]*=l,rt.elements[8]*=d,rt.elements[9]*=d,rt.elements[10]*=d,n.setFromRotationMatrix(rt),i.x=o,i.y=a,i.z=c,this}makePerspective(e,n,i,r,s,o,a=Xn,c=!1){let h=this.elements,l=2*s/(n-e),d=2*s/(i-r),u=(n+e)/(n-e),f=(i+r)/(i-r),p,m;if(c)p=s/(o-s),m=o*s/(o-s);else if(a===Xn)p=-(o+s)/(o-s),m=-2*o*s/(o-s);else if(a===Hr)p=-o/(o-s),m=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return h[0]=l,h[4]=0,h[8]=u,h[12]=0,h[1]=0,h[5]=d,h[9]=f,h[13]=0,h[2]=0,h[6]=0,h[10]=p,h[14]=m,h[3]=0,h[7]=0,h[11]=-1,h[15]=0,this}makeOrthographic(e,n,i,r,s,o,a=Xn,c=!1){let h=this.elements,l=2/(n-e),d=2/(i-r),u=-(n+e)/(n-e),f=-(i+r)/(i-r),p,m;if(c)p=1/(o-s),m=o/(o-s);else if(a===Xn)p=-2/(o-s),m=-(o+s)/(o-s);else if(a===Hr)p=-1/(o-s),m=-s/(o-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return h[0]=l,h[4]=0,h[8]=0,h[12]=u,h[1]=0,h[5]=d,h[9]=0,h[13]=f,h[2]=0,h[6]=0,h[10]=p,h[14]=m,h[3]=0,h[7]=0,h[11]=0,h[15]=1,this}equals(e){let n=this.elements,i=e.elements;for(let r=0;r<16;r++)if(n[r]!==i[r])return!1;return!0}fromArray(e,n=0){for(let i=0;i<16;i++)this.elements[i]=e[i+n];return this}toArray(e=[],n=0){let i=this.elements;return e[n]=i[0],e[n+1]=i[1],e[n+2]=i[2],e[n+3]=i[3],e[n+4]=i[4],e[n+5]=i[5],e[n+6]=i[6],e[n+7]=i[7],e[n+8]=i[8],e[n+9]=i[9],e[n+10]=i[10],e[n+11]=i[11],e[n+12]=i[12],e[n+13]=i[13],e[n+14]=i[14],e[n+15]=i[15],e}},Mn=new le,rt=new ft,$u=new le(0,0,0),Yu=new le(1,1,1),Bt=new le,Si=new le,ze=new le,aa=new ft,la=new Oe,Yn=class t{constructor(e=0,n=0,i=0,r=t.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=n,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,n,i,r=this._order){return this._x=e,this._y=n,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,n=this._order,i=!0){let r=e.elements,s=r[0],o=r[4],a=r[8],c=r[1],h=r[5],l=r[9],d=r[2],u=r[6],f=r[10];switch(n){case"XYZ":this._y=Math.asin(ee(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-l,f),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(u,h),this._z=0);break;case"YXZ":this._x=Math.asin(-ee(l,-1,1)),Math.abs(l)<.9999999?(this._y=Math.atan2(a,f),this._z=Math.atan2(c,h)):(this._y=Math.atan2(-d,s),this._z=0);break;case"ZXY":this._x=Math.asin(ee(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-d,f),this._z=Math.atan2(-o,h)):(this._y=0,this._z=Math.atan2(c,s));break;case"ZYX":this._y=Math.asin(-ee(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(u,f),this._z=Math.atan2(c,s)):(this._x=0,this._z=Math.atan2(-o,h));break;case"YZX":this._z=Math.asin(ee(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-l,h),this._y=Math.atan2(-d,s)):(this._x=0,this._y=Math.atan2(a,f));break;case"XZY":this._z=Math.asin(-ee(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(u,h),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-l,f),this._y=0);break;default:Ae("Euler: .setFromRotationMatrix() encountered an unknown order: "+n)}return this._order=n,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,n,i){return aa.makeRotationFromQuaternion(e),this.setFromRotationMatrix(aa,n,i)}setFromVector3(e,n=this._order){return this.set(e.x,e.y,e.z,n)}reorder(e){return la.setFromEuler(this),this.setFromQuaternion(la,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],n=0){return e[n]=this._x,e[n+1]=this._y,e[n+2]=this._z,e[n+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Yn.DEFAULT_ORDER="XYZ";var Li=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},Ku=0,ca=new le,Tn=new Oe,St=new ft,Mi=new le,Hn=new le,ju=new le,Zu=new Oe,ha=new le(1,0,0),ua=new le(0,1,0),fa=new le(0,0,1),da={type:"added"},Ju={type:"removed"},An={type:"childadded",child:null},Ar={type:"childremoved",child:null},Pn=class t extends $n{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Ku++}),this.uuid=is(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=t.DEFAULT_UP.clone();let e=new le,n=new Yn,i=new Oe,r=new le(1,1,1);function s(){i.setFromEuler(n,!1)}function o(){n.setFromQuaternion(i,void 0,!1)}n._onChange(s),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new ft},normalMatrix:{value:new $}}),this.matrix=new ft,this.matrixWorld=new ft,this.matrixAutoUpdate=t.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=t.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Li,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,n){this.quaternion.setFromAxisAngle(e,n)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,n){return Tn.setFromAxisAngle(e,n),this.quaternion.multiply(Tn),this}rotateOnWorldAxis(e,n){return Tn.setFromAxisAngle(e,n),this.quaternion.premultiply(Tn),this}rotateX(e){return this.rotateOnAxis(ha,e)}rotateY(e){return this.rotateOnAxis(ua,e)}rotateZ(e){return this.rotateOnAxis(fa,e)}translateOnAxis(e,n){return ca.copy(e).applyQuaternion(this.quaternion),this.position.add(ca.multiplyScalar(n)),this}translateX(e){return this.translateOnAxis(ha,e)}translateY(e){return this.translateOnAxis(ua,e)}translateZ(e){return this.translateOnAxis(fa,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(St.copy(this.matrixWorld).invert())}lookAt(e,n,i){e.isVector3?Mi.copy(e):Mi.set(e,n,i);let r=this.parent;this.updateWorldMatrix(!0,!1),Hn.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?St.lookAt(Hn,Mi,this.up):St.lookAt(Mi,Hn,this.up),this.quaternion.setFromRotationMatrix(St),r&&(St.extractRotation(r.matrixWorld),Tn.setFromRotationMatrix(St),this.quaternion.premultiply(Tn.invert()))}add(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.add(arguments[n]);return this}return e===this?(xe("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(da),An.child=e,this.dispatchEvent(An),An.child=null):xe("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let n=this.children.indexOf(e);return n!==-1&&(e.parent=null,this.children.splice(n,1),e.dispatchEvent(Ju),Ar.child=e,this.dispatchEvent(Ar),Ar.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),St.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),St.multiply(e.parent.matrixWorld)),e.applyMatrix4(St),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(da),An.child=e,this.dispatchEvent(An),An.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,n){if(this[e]===n)return this;for(let i=0,r=this.children.length;i<r;i++){let o=this.children[i].getObjectByProperty(e,n);if(o!==void 0)return o}}getObjectsByProperty(e,n,i=[]){this[e]===n&&i.push(this);let r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].getObjectsByProperty(e,n,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Hn,e,ju),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Hn,Zu,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let n=this.matrixWorld.elements;return e.set(n[8],n[9],n[10]).normalize()}raycast(){}traverse(e){e(this);let n=this.children;for(let i=0,r=n.length;i<r;i++)n[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let n=this.children;for(let i=0,r=n.length;i<r;i++)n[i].traverseVisible(e)}traverseAncestors(e){let n=this.parent;n!==null&&(e(n),n.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let n=e.x,i=e.y,r=e.z,s=this.matrix.elements;s[12]+=n-s[0]*n-s[4]*i-s[8]*r,s[13]+=i-s[1]*n-s[5]*i-s[9]*r,s[14]+=r-s[2]*n-s[6]*i-s[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let n=this.children;for(let i=0,r=n.length;i<r;i++)n[i].updateMatrixWorld(e)}updateWorldMatrix(e,n){let i=this.parent;if(e===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),n===!0){let r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].updateWorldMatrix(!1,!0)}}toJSON(e){let n=e===void 0||typeof e=="string",i={};n&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),this.static!==!1&&(r.static=this.static),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(a=>({...a})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(a,c){return a[c.uuid]===void 0&&(a[c.uuid]=c.toJSON(e)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let c=a.shapes;if(Array.isArray(c))for(let h=0,l=c.length;h<l;h++){let d=c[h];s(e.shapes,d)}else s(e.shapes,c)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let c=0,h=this.material.length;c<h;c++)a.push(s(e.materials,this.material[c]));r.material=a}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let a=0;a<this.children.length;a++)r.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let a=0;a<this.animations.length;a++){let c=this.animations[a];r.animations.push(s(e.animations,c))}}if(n){let a=o(e.geometries),c=o(e.materials),h=o(e.textures),l=o(e.images),d=o(e.shapes),u=o(e.skeletons),f=o(e.animations),p=o(e.nodes);a.length>0&&(i.geometries=a),c.length>0&&(i.materials=c),h.length>0&&(i.textures=h),l.length>0&&(i.images=l),d.length>0&&(i.shapes=d),u.length>0&&(i.skeletons=u),f.length>0&&(i.animations=f),p.length>0&&(i.nodes=p)}return i.object=r,i;function o(a){let c=[];for(let h in a){let l=a[h];delete l.metadata,c.push(l)}return c}}clone(e){return new this.constructor().copy(this,e)}copy(e,n=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),e.pivot!==null&&(this.pivot=e.pivot.clone()),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),n===!0)for(let i=0;i<e.children.length;i++){let r=e.children[i];this.add(r.clone())}return this}};Pn.DEFAULT_UP=new le(0,1,0);Pn.DEFAULT_MATRIX_AUTO_UPDATE=!0;Pn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Ea={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Ot={h:0,s:0,l:0},Ti={h:0,s:0,l:0};function Er(t,e,n){return n<0&&(n+=1),n>1&&(n-=1),n<1/6?t+(e-t)*6*n:n<1/2?e:n<2/3?t+(e-t)*6*(2/3-n):t}var ye=class{constructor(e,n,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,n,i)}set(e,n,i){if(n===void 0&&i===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,n,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,n=Ye){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,$e.colorSpaceToWorking(this,n),this}setRGB(e,n,i,r=$e.workingColorSpace){return this.r=e,this.g=n,this.b=i,$e.colorSpaceToWorking(this,r),this}setHSL(e,n,i,r=$e.workingColorSpace){if(e=Hu(e,1),n=ee(n,0,1),i=ee(i,0,1),n===0)this.r=this.g=this.b=i;else{let s=i<=.5?i*(1+n):i+n-i*n,o=2*i-s;this.r=Er(o,s,e+1/3),this.g=Er(o,s,e),this.b=Er(o,s,e-1/3)}return $e.colorSpaceToWorking(this,r),this}setStyle(e,n=Ye){function i(s){s!==void 0&&parseFloat(s)<1&&Ae("Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s,o=r[1],a=r[2];switch(o){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,n);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,n);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,n);break;default:Ae("Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let s=r[1],o=s.length;if(o===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,n);if(o===6)return this.setHex(parseInt(s,16),n);Ae("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,n);return this}setColorName(e,n=Ye){let i=Ea[e.toLowerCase()];return i!==void 0?this.setHex(i,n):Ae("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Mt(e.r),this.g=Mt(e.g),this.b=Mt(e.b),this}copyLinearToSRGB(e){return this.r=En(e.r),this.g=En(e.g),this.b=En(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Ye){return $e.workingToColorSpace(Te.copy(this),e),Math.round(ee(Te.r*255,0,255))*65536+Math.round(ee(Te.g*255,0,255))*256+Math.round(ee(Te.b*255,0,255))}getHexString(e=Ye){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,n=$e.workingColorSpace){$e.workingToColorSpace(Te.copy(this),n);let i=Te.r,r=Te.g,s=Te.b,o=Math.max(i,r,s),a=Math.min(i,r,s),c,h,l=(a+o)/2;if(a===o)c=0,h=0;else{let d=o-a;switch(h=l<=.5?d/(o+a):d/(2-o-a),o){case i:c=(r-s)/d+(r<s?6:0);break;case r:c=(s-i)/d+2;break;case s:c=(i-r)/d+4;break}c/=6}return e.h=c,e.s=h,e.l=l,e}getRGB(e,n=$e.workingColorSpace){return $e.workingToColorSpace(Te.copy(this),n),e.r=Te.r,e.g=Te.g,e.b=Te.b,e}getStyle(e=Ye){$e.workingToColorSpace(Te.copy(this),e);let n=Te.r,i=Te.g,r=Te.b;return e!==Ye?`color(${e} ${n.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(n*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(e,n,i){return this.getHSL(Ot),this.setHSL(Ot.h+e,Ot.s+n,Ot.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,n){return this.r=e.r+n.r,this.g=e.g+n.g,this.b=e.b+n.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,n){return this.r+=(e.r-this.r)*n,this.g+=(e.g-this.g)*n,this.b+=(e.b-this.b)*n,this}lerpColors(e,n,i){return this.r=e.r+(n.r-e.r)*i,this.g=e.g+(n.g-e.g)*i,this.b=e.b+(n.b-e.b)*i,this}lerpHSL(e,n){this.getHSL(Ot),e.getHSL(Ti);let i=_r(Ot.h,Ti.h,n),r=_r(Ot.s,Ti.s,n),s=_r(Ot.l,Ti.l,n);return this.setHSL(i,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let n=this.r,i=this.g,r=this.b,s=e.elements;return this.r=s[0]*n+s[3]*i+s[6]*r,this.g=s[1]*n+s[4]*i+s[7]*r,this.b=s[2]*n+s[5]*i+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,n=0){return this.r=e[n],this.g=e[n+1],this.b=e[n+2],this}toArray(e=[],n=0){return e[n]=this.r,e[n+1]=this.g,e[n+2]=this.b,e}fromBufferAttribute(e,n){return this.r=e.getX(n),this.g=e.getY(n),this.b=e.getZ(n),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Te=new ye;ye.NAMES=Ea;function wa(t){let e={};for(let n in t){e[n]={};for(let i in t[n]){let r=t[n][i];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?r.isRenderTargetTexture?(Ae("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[n][i]=null):e[n][i]=r.clone():Array.isArray(r)?e[n][i]=r.slice():e[n][i]=r}}return e}function Fe(t){let e={};for(let n=0;n<t.length;n++){let i=wa(t[n]);for(let r in i)e[r]=i[r]}return e}function Ai(t,e){return!t||t.constructor===e?t:typeof e.BYTES_PER_ELEMENT=="number"?new e(t):Array.prototype.slice.call(t)}var Vt=class{constructor(e,n,i,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new n.constructor(i),this.sampleValues=n,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){let n=this.parameterPositions,i=this._cachedIndex,r=n[i],s=n[i-1];n:{e:{let o;t:{i:if(!(e<r)){for(let a=i+2;;){if(r===void 0){if(e<s)break i;return i=n.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===a)break;if(s=r,r=n[++i],e<r)break e}o=n.length;break t}if(!(e>=s)){let a=n[1];e<a&&(i=2,s=a);for(let c=i-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===c)break;if(r=s,s=n[--i-1],e>=s)break e}o=i,i=0;break t}break n}for(;i<o;){let a=i+o>>>1;e<n[a]?o=a:i=a+1}if(r=n[i],s=n[i-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return i=n.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,s,r)}return this.interpolate_(i,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let n=this.resultBuffer,i=this.sampleValues,r=this.valueSize,s=e*r;for(let o=0;o!==r;++o)n[o]=i[s+o];return n}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}},Fi=class extends Vt{constructor(e,n,i,r){super(e,n,i,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Or,endingEnd:Or}}intervalChanged_(e,n,i){let r=this.parameterPositions,s=e-2,o=e+1,a=r[s],c=r[o];if(a===void 0)switch(this.getSettings_().endingStart){case Vr:s=e,a=2*n-i;break;case Gr:s=r.length-2,a=n+r[s]-r[s+1];break;default:s=e,a=i}if(c===void 0)switch(this.getSettings_().endingEnd){case Vr:o=e,c=2*i-n;break;case Gr:o=1,c=i+r[1]-r[0];break;default:o=e-1,c=n}let h=(i-n)*.5,l=this.valueSize;this._weightPrev=h/(n-a),this._weightNext=h/(c-i),this._offsetPrev=s*l,this._offsetNext=o*l}interpolate_(e,n,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,h=c-a,l=this._offsetPrev,d=this._offsetNext,u=this._weightPrev,f=this._weightNext,p=(i-n)/(r-n),m=p*p,x=m*p,g=-u*x+2*u*m-u*p,y=(1+u)*x+(-1.5-2*u)*m+(-.5+u)*p+1,v=(-1-f)*x+(1.5+f)*m+.5*p,b=f*x-f*m;for(let M=0;M!==a;++M)s[M]=g*o[l+M]+y*o[h+M]+v*o[c+M]+b*o[d+M];return s}},Di=class extends Vt{constructor(e,n,i,r){super(e,n,i,r)}interpolate_(e,n,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,h=c-a,l=(i-n)/(r-n),d=1-l;for(let u=0;u!==a;++u)s[u]=o[h+u]*d+o[c+u]*l;return s}},Ui=class extends Vt{constructor(e,n,i,r){super(e,n,i,r)}interpolate_(e){return this.copySampleValue_(e-1)}},Ni=class extends Vt{interpolate_(e,n,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=e*a,h=c-a,l=this.settings||this.DefaultSettings_,d=l.inTangents,u=l.outTangents;if(!d||!u){let m=(i-n)/(r-n),x=1-m;for(let g=0;g!==a;++g)s[g]=o[h+g]*x+o[c+g]*m;return s}let f=a*2,p=e-1;for(let m=0;m!==a;++m){let x=o[h+m],g=o[c+m],y=p*f+m*2,v=u[y],b=u[y+1],M=e*f+m*2,_=d[M],T=d[M+1],P=(i-n)/(r-n),A,O,N,F,C;for(let D=0;D<8;D++){A=P*P,O=A*P,N=1-P,F=N*N,C=F*N;let R=C*n+3*F*P*v+3*N*A*_+O*r-i;if(Math.abs(R)<1e-10)break;let oe=3*F*(v-n)+6*N*P*(_-v)+3*A*(r-_);if(Math.abs(oe)<1e-10)break;P=P-R/oe,P=Math.max(0,Math.min(1,P))}s[m]=C*x+3*F*P*b+3*N*A*T+O*g}return s}},He=class{constructor(e,n,i,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(n===void 0||n.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Ai(n,this.TimeBufferType),this.values=Ai(i,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let n=e.constructor,i;if(n.toJSON!==this.toJSON)i=n.toJSON(e);else{i={name:e.name,times:Ai(e.times,Array),values:Ai(e.values,Array)};let r=e.getInterpolation();r!==e.DefaultInterpolation&&(i.interpolation=r)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new Ui(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Di(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Fi(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let n=new Ni(this.times,this.values,this.getValueSize(),e);return this.settings&&(n.settings=this.settings),n}setInterpolation(e){let n;switch(e){case qn:n=this.InterpolantFactoryMethodDiscrete;break;case Pi:n=this.InterpolantFactoryMethodLinear;break;case Ei:n=this.InterpolantFactoryMethodSmooth;break;case Br:n=this.InterpolantFactoryMethodBezier;break}if(n===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return Ae("KeyframeTrack:",i),this}return this.createInterpolant=n,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return qn;case this.InterpolantFactoryMethodLinear:return Pi;case this.InterpolantFactoryMethodSmooth:return Ei;case this.InterpolantFactoryMethodBezier:return Br}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let n=this.times;for(let i=0,r=n.length;i!==r;++i)n[i]+=e}return this}scale(e){if(e!==1){let n=this.times;for(let i=0,r=n.length;i!==r;++i)n[i]*=e}return this}trim(e,n){let i=this.times,r=i.length,s=0,o=r-1;for(;s!==r&&i[s]<e;)++s;for(;o!==-1&&i[o]>n;)--o;if(++o,s!==0||o!==r){s>=o&&(o=Math.max(o,1),s=o-1);let a=this.getValueSize();this.times=i.slice(s,o),this.values=this.values.slice(s*a,o*a)}return this}validate(){let e=!0,n=this.getValueSize();n-Math.floor(n)!==0&&(xe("KeyframeTrack: Invalid value size in track.",this),e=!1);let i=this.times,r=this.values,s=i.length;s===0&&(xe("KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==s;a++){let c=i[a];if(typeof c=="number"&&isNaN(c)){xe("KeyframeTrack: Time is not a valid number.",this,a,c),e=!1;break}if(o!==null&&o>c){xe("KeyframeTrack: Out of order keys.",this,a,c,o),e=!1;break}o=c}if(r!==void 0&&Gu(r))for(let a=0,c=r.length;a!==c;++a){let h=r[a];if(isNaN(h)){xe("KeyframeTrack: Value is not a valid number.",this,a,h),e=!1;break}}return e}optimize(){let e=this.times.slice(),n=this.values.slice(),i=this.getValueSize(),r=this.getInterpolation()===Ei,s=e.length-1,o=1;for(let a=1;a<s;++a){let c=!1,h=e[a],l=e[a+1];if(h!==l&&(a!==1||h!==e[0]))if(r)c=!0;else{let d=a*i,u=d-i,f=d+i;for(let p=0;p!==i;++p){let m=n[d+p];if(m!==n[u+p]||m!==n[f+p]){c=!0;break}}}if(c){if(a!==o){e[o]=e[a];let d=a*i,u=o*i;for(let f=0;f!==i;++f)n[u+f]=n[d+f]}++o}}if(s>0){e[o]=e[s];for(let a=s*i,c=o*i,h=0;h!==i;++h)n[c+h]=n[a+h];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=n.slice(0,o*i)):(this.times=e,this.values=n),this}clone(){let e=this.times.slice(),n=this.values.slice(),i=this.constructor,r=new i(this.name,e,n);return r.createInterpolant=this.createInterpolant,r}};He.prototype.ValueTypeName="";He.prototype.TimeBufferType=Float32Array;He.prototype.ValueBufferType=Float32Array;He.prototype.DefaultInterpolation=Pi;var Gt=class extends He{constructor(e,n,i){super(e,n,i)}};Gt.prototype.ValueTypeName="bool";Gt.prototype.ValueBufferType=Array;Gt.prototype.DefaultInterpolation=qn;Gt.prototype.InterpolantFactoryMethodLinear=void 0;Gt.prototype.InterpolantFactoryMethodSmooth=void 0;var Bi=class extends He{constructor(e,n,i,r){super(e,n,i,r)}};Bi.prototype.ValueTypeName="color";var Oi=class extends He{constructor(e,n,i,r){super(e,n,i,r)}};Oi.prototype.ValueTypeName="number";var Vi=class extends Vt{constructor(e,n,i,r){super(e,n,i,r)}interpolate_(e,n,i,r){let s=this.resultBuffer,o=this.sampleValues,a=this.valueSize,c=(i-n)/(r-n),h=e*a;for(let l=h+a;h!==l;h+=4)Oe.slerpFlat(s,0,o,h-a,o,h,c);return s}},Kn=class extends He{constructor(e,n,i,r){super(e,n,i,r)}InterpolantFactoryMethodLinear(e){return new Vi(this.times,this.values,this.getValueSize(),e)}};Kn.prototype.ValueTypeName="quaternion";Kn.prototype.InterpolantFactoryMethodSmooth=void 0;var kt=class extends He{constructor(e,n,i){super(e,n,i)}};kt.prototype.ValueTypeName="string";kt.prototype.ValueBufferType=Array;kt.prototype.DefaultInterpolation=qn;kt.prototype.InterpolantFactoryMethodLinear=void 0;kt.prototype.InterpolantFactoryMethodSmooth=void 0;var Gi=class extends He{constructor(e,n,i,r){super(e,n,i,r)}};Gi.prototype.ValueTypeName="vector";var ki=class{constructor(e,n,i){let r=this,s=!1,o=0,a=0,c,h=[];this.onStart=void 0,this.onLoad=e,this.onProgress=n,this.onError=i,this._abortController=null,this.itemStart=function(l){a++,s===!1&&r.onStart!==void 0&&r.onStart(l,o,a),s=!0},this.itemEnd=function(l){o++,r.onProgress!==void 0&&r.onProgress(l,o,a),o===a&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(l){r.onError!==void 0&&r.onError(l)},this.resolveURL=function(l){return c?c(l):l},this.setURLModifier=function(l){return c=l,this},this.addHandler=function(l,d){return h.push(l,d),this},this.removeHandler=function(l){let d=h.indexOf(l);return d!==-1&&h.splice(d,2),this},this.getHandler=function(l){for(let d=0,u=h.length;d<u;d+=2){let f=h[d],p=h[d+1];if(f.global&&(f.lastIndex=0),f.test(l))return p}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Pa=new ki,zi=class{constructor(e){this.manager=e!==void 0?e:Pa,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,n){let i=this;return new Promise(function(r,s){i.load(e,r,n,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};zi.DEFAULT_MATERIAL_NAME="__DEFAULT";var rs="\\[\\]\\.:\\/",Qu=new RegExp("["+rs+"]","g"),ss="[^"+rs+"]",ef="[^"+rs.replace("\\.","")+"]",tf=/((?:WC+[\/:])*)/.source.replace("WC",ss),nf=/(WCOD+)?/.source.replace("WCOD",ef),rf=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",ss),sf=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",ss),of=new RegExp("^"+tf+nf+rf+sf+"$"),af=["material","materials","bones","map"],qr=class{constructor(e,n,i){let r=i||se.parseTrackName(n);this._targetGroup=e,this._bindings=e.subscribe_(n,r)}getValue(e,n){this.bind();let i=this._targetGroup.nCachedObjects_,r=this._bindings[i];r!==void 0&&r.getValue(e,n)}setValue(e,n){let i=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=i.length;r!==s;++r)i[r].setValue(e,n)}bind(){let e=this._bindings;for(let n=this._targetGroup.nCachedObjects_,i=e.length;n!==i;++n)e[n].bind()}unbind(){let e=this._bindings;for(let n=this._targetGroup.nCachedObjects_,i=e.length;n!==i;++n)e[n].unbind()}},se=class t{constructor(e,n,i){this.path=n,this.parsedPath=i||t.parseTrackName(n),this.node=t.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,n,i){return e&&e.isAnimationObjectGroup?new t.Composite(e,n,i):new t(e,n,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(Qu,"")}static parseTrackName(e){let n=of.exec(e);if(n===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);let i={nodeName:n[2],objectName:n[3],objectIndex:n[4],propertyName:n[5],propertyIndex:n[6]},r=i.nodeName&&i.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){let s=i.nodeName.substring(r+1);af.indexOf(s)!==-1&&(i.nodeName=i.nodeName.substring(0,r),i.objectName=s)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,n){if(n===void 0||n===""||n==="."||n===-1||n===e.name||n===e.uuid)return e;if(e.skeleton){let i=e.skeleton.getBoneByName(n);if(i!==void 0)return i}if(e.children){let i=function(s){for(let o=0;o<s.length;o++){let a=s[o];if(a.name===n||a.uuid===n)return a;let c=i(a.children);if(c)return c}return null},r=i(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,n){e[n]=this.targetObject[this.propertyName]}_getValue_array(e,n){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)e[n++]=i[r]}_getValue_arrayElement(e,n){e[n]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,n){this.resolvedProperty.toArray(e,n)}_setValue_direct(e,n){this.targetObject[this.propertyName]=e[n]}_setValue_direct_setNeedsUpdate(e,n){this.targetObject[this.propertyName]=e[n],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,n){this.targetObject[this.propertyName]=e[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,n){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[n++]}_setValue_array_setNeedsUpdate(e,n){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[n++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,n){let i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[n++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,n){this.resolvedProperty[this.propertyIndex]=e[n]}_setValue_arrayElement_setNeedsUpdate(e,n){this.resolvedProperty[this.propertyIndex]=e[n],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,n){this.resolvedProperty[this.propertyIndex]=e[n],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,n){this.resolvedProperty.fromArray(e,n)}_setValue_fromArray_setNeedsUpdate(e,n){this.resolvedProperty.fromArray(e,n),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,n){this.resolvedProperty.fromArray(e,n),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,n){this.bind(),this.getValue(e,n)}_setValue_unbound(e,n){this.bind(),this.setValue(e,n)}bind(){let e=this.node,n=this.parsedPath,i=n.objectName,r=n.propertyName,s=n.propertyIndex;if(e||(e=t.findNode(this.rootNode,n.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Ae("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let h=n.objectIndex;switch(i){case"materials":if(!e.material){xe("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){xe("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){xe("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let l=0;l<e.length;l++)if(e[l].name===h){h=l;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){xe("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){xe("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){xe("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(h!==void 0){if(e[h]===void 0){xe("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[h]}}let o=e[r];if(o===void 0){let h=n.nodeName;xe("PropertyBinding: Trying to update property for track: "+h+"."+r+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?a=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){xe("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){xe("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}c=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=s}else o.fromArray!==void 0&&o.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(c=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=r;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};se.Composite=qr;se.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};se.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};se.prototype.GetterByBindingType=[se.prototype._getValue_direct,se.prototype._getValue_array,se.prototype._getValue_arrayElement,se.prototype._getValue_toArray];se.prototype.SetterByBindingTypeAndVersioning=[[se.prototype._setValue_direct,se.prototype._setValue_direct_setNeedsUpdate,se.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[se.prototype._setValue_array,se.prototype._setValue_array_setNeedsUpdate,se.prototype._setValue_array_setMatrixWorldNeedsUpdate],[se.prototype._setValue_arrayElement,se.prototype._setValue_arrayElement_setNeedsUpdate,se.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[se.prototype._setValue_fromArray,se.prototype._setValue_fromArray_setNeedsUpdate,se.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Xg=new Float32Array(1);typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"183"}}));typeof window<"u"&&(window.__THREE__?Ae("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="183");var lf=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,cf=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,hf=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,uf=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,ff=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,df=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,pf=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,mf=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,gf=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,vf=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,xf=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,yf=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,_f=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,bf=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Sf=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Mf=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Tf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Af=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Ef=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,wf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Pf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Cf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Rf=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,If=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Lf=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Ff=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,Df=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Uf=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Nf=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Bf=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Of="gl_FragColor = linearToOutputTexel( gl_FragColor );",Vf=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Gf=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,kf=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,zf=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Hf=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Wf=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Xf=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,qf=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,$f=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Yf=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Kf=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,jf=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Zf=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Jf=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Qf=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,ed=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,td=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,nd=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,id=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,rd=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,sd=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,od=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return v;
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,ad=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,ld=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,cd=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,hd=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,ud=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,fd=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,dd=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,pd=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,md=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,gd=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,vd=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,xd=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,yd=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,_d=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,bd=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Sd=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Md=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Td=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Ad=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Ed=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,wd=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Pd=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Cd=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Rd=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Id=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Ld=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Fd=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Dd=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Ud=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Nd=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Bd=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Od=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Vd=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Gd=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,kd=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,zd=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Hd=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,Wd=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Xd=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,qd=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,$d=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Yd=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Kd=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,jd=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Zd=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Jd=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Qd=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,ep=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,tp=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,np=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,ip=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,rp=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,sp=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,op=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,ap=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,lp=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,hp=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,up=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,fp=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,dp=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,pp=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,mp=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,gp=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,vp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,xp=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,yp=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,_p=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,bp=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Sp=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Mp=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Tp=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ap=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Ep=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,wp=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Pp=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Cp=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Rp=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ip=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Lp=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Fp=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Dp=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Up=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Np=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Bp=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Op=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Vp=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Gp=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,j={alphahash_fragment:lf,alphahash_pars_fragment:cf,alphamap_fragment:hf,alphamap_pars_fragment:uf,alphatest_fragment:ff,alphatest_pars_fragment:df,aomap_fragment:pf,aomap_pars_fragment:mf,batching_pars_vertex:gf,batching_vertex:vf,begin_vertex:xf,beginnormal_vertex:yf,bsdfs:_f,iridescence_fragment:bf,bumpmap_pars_fragment:Sf,clipping_planes_fragment:Mf,clipping_planes_pars_fragment:Tf,clipping_planes_pars_vertex:Af,clipping_planes_vertex:Ef,color_fragment:wf,color_pars_fragment:Pf,color_pars_vertex:Cf,color_vertex:Rf,common:If,cube_uv_reflection_fragment:Lf,defaultnormal_vertex:Ff,displacementmap_pars_vertex:Df,displacementmap_vertex:Uf,emissivemap_fragment:Nf,emissivemap_pars_fragment:Bf,colorspace_fragment:Of,colorspace_pars_fragment:Vf,envmap_fragment:Gf,envmap_common_pars_fragment:kf,envmap_pars_fragment:zf,envmap_pars_vertex:Hf,envmap_physical_pars_fragment:ed,envmap_vertex:Wf,fog_vertex:Xf,fog_pars_vertex:qf,fog_fragment:$f,fog_pars_fragment:Yf,gradientmap_pars_fragment:Kf,lightmap_pars_fragment:jf,lights_lambert_fragment:Zf,lights_lambert_pars_fragment:Jf,lights_pars_begin:Qf,lights_toon_fragment:td,lights_toon_pars_fragment:nd,lights_phong_fragment:id,lights_phong_pars_fragment:rd,lights_physical_fragment:sd,lights_physical_pars_fragment:od,lights_fragment_begin:ad,lights_fragment_maps:ld,lights_fragment_end:cd,logdepthbuf_fragment:hd,logdepthbuf_pars_fragment:ud,logdepthbuf_pars_vertex:fd,logdepthbuf_vertex:dd,map_fragment:pd,map_pars_fragment:md,map_particle_fragment:gd,map_particle_pars_fragment:vd,metalnessmap_fragment:xd,metalnessmap_pars_fragment:yd,morphinstance_vertex:_d,morphcolor_vertex:bd,morphnormal_vertex:Sd,morphtarget_pars_vertex:Md,morphtarget_vertex:Td,normal_fragment_begin:Ad,normal_fragment_maps:Ed,normal_pars_fragment:wd,normal_pars_vertex:Pd,normal_vertex:Cd,normalmap_pars_fragment:Rd,clearcoat_normal_fragment_begin:Id,clearcoat_normal_fragment_maps:Ld,clearcoat_pars_fragment:Fd,iridescence_pars_fragment:Dd,opaque_fragment:Ud,packing:Nd,premultiplied_alpha_fragment:Bd,project_vertex:Od,dithering_fragment:Vd,dithering_pars_fragment:Gd,roughnessmap_fragment:kd,roughnessmap_pars_fragment:zd,shadowmap_pars_fragment:Hd,shadowmap_pars_vertex:Wd,shadowmap_vertex:Xd,shadowmask_pars_fragment:qd,skinbase_vertex:$d,skinning_pars_vertex:Yd,skinning_vertex:Kd,skinnormal_vertex:jd,specularmap_fragment:Zd,specularmap_pars_fragment:Jd,tonemapping_fragment:Qd,tonemapping_pars_fragment:ep,transmission_fragment:tp,transmission_pars_fragment:np,uv_pars_fragment:ip,uv_pars_vertex:rp,uv_vertex:sp,worldpos_vertex:op,background_vert:ap,background_frag:lp,backgroundCube_vert:cp,backgroundCube_frag:hp,cube_vert:up,cube_frag:fp,depth_vert:dp,depth_frag:pp,distance_vert:mp,distance_frag:gp,equirect_vert:vp,equirect_frag:xp,linedashed_vert:yp,linedashed_frag:_p,meshbasic_vert:bp,meshbasic_frag:Sp,meshlambert_vert:Mp,meshlambert_frag:Tp,meshmatcap_vert:Ap,meshmatcap_frag:Ep,meshnormal_vert:wp,meshnormal_frag:Pp,meshphong_vert:Cp,meshphong_frag:Rp,meshphysical_vert:Ip,meshphysical_frag:Lp,meshtoon_vert:Fp,meshtoon_frag:Dp,points_vert:Up,points_frag:Np,shadow_vert:Bp,shadow_frag:Op,sprite_vert:Vp,sprite_frag:Gp},I={common:{diffuse:{value:new ye(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new $},alphaMap:{value:null},alphaMapTransform:{value:new $},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new $}},envmap:{envMap:{value:null},envMapRotation:{value:new $},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new $}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new $}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new $},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new $},normalScale:{value:new st(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new $},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new $}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new $}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new $}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ye(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new ye(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new $},alphaTest:{value:0},uvTransform:{value:new $}},sprite:{diffuse:{value:new ye(16777215)},opacity:{value:1},center:{value:new st(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new $},alphaMap:{value:null},alphaMapTransform:{value:new $},alphaTest:{value:0}}},Ca={basic:{uniforms:Fe([I.common,I.specularmap,I.envmap,I.aomap,I.lightmap,I.fog]),vertexShader:j.meshbasic_vert,fragmentShader:j.meshbasic_frag},lambert:{uniforms:Fe([I.common,I.specularmap,I.envmap,I.aomap,I.lightmap,I.emissivemap,I.bumpmap,I.normalmap,I.displacementmap,I.fog,I.lights,{emissive:{value:new ye(0)},envMapIntensity:{value:1}}]),vertexShader:j.meshlambert_vert,fragmentShader:j.meshlambert_frag},phong:{uniforms:Fe([I.common,I.specularmap,I.envmap,I.aomap,I.lightmap,I.emissivemap,I.bumpmap,I.normalmap,I.displacementmap,I.fog,I.lights,{emissive:{value:new ye(0)},specular:{value:new ye(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:j.meshphong_vert,fragmentShader:j.meshphong_frag},standard:{uniforms:Fe([I.common,I.envmap,I.aomap,I.lightmap,I.emissivemap,I.bumpmap,I.normalmap,I.displacementmap,I.roughnessmap,I.metalnessmap,I.fog,I.lights,{emissive:{value:new ye(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:j.meshphysical_vert,fragmentShader:j.meshphysical_frag},toon:{uniforms:Fe([I.common,I.aomap,I.lightmap,I.emissivemap,I.bumpmap,I.normalmap,I.displacementmap,I.gradientmap,I.fog,I.lights,{emissive:{value:new ye(0)}}]),vertexShader:j.meshtoon_vert,fragmentShader:j.meshtoon_frag},matcap:{uniforms:Fe([I.common,I.bumpmap,I.normalmap,I.displacementmap,I.fog,{matcap:{value:null}}]),vertexShader:j.meshmatcap_vert,fragmentShader:j.meshmatcap_frag},points:{uniforms:Fe([I.points,I.fog]),vertexShader:j.points_vert,fragmentShader:j.points_frag},dashed:{uniforms:Fe([I.common,I.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:j.linedashed_vert,fragmentShader:j.linedashed_frag},depth:{uniforms:Fe([I.common,I.displacementmap]),vertexShader:j.depth_vert,fragmentShader:j.depth_frag},normal:{uniforms:Fe([I.common,I.bumpmap,I.normalmap,I.displacementmap,{opacity:{value:1}}]),vertexShader:j.meshnormal_vert,fragmentShader:j.meshnormal_frag},sprite:{uniforms:Fe([I.sprite,I.fog]),vertexShader:j.sprite_vert,fragmentShader:j.sprite_frag},background:{uniforms:{uvTransform:{value:new $},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:j.background_vert,fragmentShader:j.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new $}},vertexShader:j.backgroundCube_vert,fragmentShader:j.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:j.cube_vert,fragmentShader:j.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:j.equirect_vert,fragmentShader:j.equirect_frag},distance:{uniforms:Fe([I.common,I.displacementmap,{referencePosition:{value:new le},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:j.distance_vert,fragmentShader:j.distance_frag},shadow:{uniforms:Fe([I.lights,I.fog,{color:{value:new ye(0)},opacity:{value:1}}]),vertexShader:j.shadow_vert,fragmentShader:j.shadow_frag}};Ca.physical={uniforms:Fe([Ca.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new $},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new $},clearcoatNormalScale:{value:new st(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new $},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new $},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new $},sheen:{value:0},sheenColor:{value:new ye(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new $},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new $},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new $},transmissionSamplerSize:{value:new st},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new $},attenuationDistance:{value:0},attenuationColor:{value:new ye(0)},specularColor:{value:new ye(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new $},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new $},anisotropyVector:{value:new st},anisotropyMap:{value:null},anisotropyMapTransform:{value:new $}}]),vertexShader:j.meshphysical_vert,fragmentShader:j.meshphysical_frag};var wS={[$r]:"LINEAR_TONE_MAPPING",[Yr]:"REINHARD_TONE_MAPPING",[Kr]:"CINEON_TONE_MAPPING",[jr]:"ACES_FILMIC_TONE_MAPPING",[Jr]:"AGX_TONE_MAPPING",[Qr]:"NEUTRAL_TONE_MAPPING",[Zr]:"CUSTOM_TONE_MAPPING"};var PS=new Float32Array(16),CS=new Float32Array(9),RS=new Float32Array(4);var IS={[$r]:"Linear",[Yr]:"Reinhard",[Kr]:"Cineon",[jr]:"ACESFilmic",[Jr]:"AgX",[Qr]:"Neutral",[Zr]:"Custom"};var LS={[pa]:"SHADOWMAP_TYPE_PCF",[ma]:"SHADOWMAP_TYPE_VSM"};var FS={[ya]:"ENVMAP_TYPE_CUBE",[ts]:"ENVMAP_TYPE_CUBE",[_a]:"ENVMAP_TYPE_CUBE_UV"};var DS={[ts]:"ENVMAP_MODE_REFRACTION"};var US={[ga]:"ENVMAP_BLENDING_MULTIPLY",[va]:"ENVMAP_BLENDING_MIX",[xa]:"ENVMAP_BLENDING_ADD"};var NS=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);function os(t,e,n={}){let{interval:i,globalSequences:r=[],globalTime:s=e,fallback:o=0,quaternion:a=!1}=n;if(t==null)return o;if(typeof t=="number"||Array.isArray(t)||ArrayBuffer.isView(t))return t;let c=i?.[0]??-1/0,h=i?.[1]??1/0,l=t.GlobalSeqId;Number.isInteger(l)&&l>=0&&r[l]>0&&(h=r[l],c=0,e=(s%h+h)%h);let d=t.Keys||[],u=0,f=d.length-1;for(;u<=f&&d[u].Frame<c;)u++;for(;f>=u&&d[f].Frame>h;)f--;if(u>f)return o;let p=d[u],m=p;if(e>=d[f].Frame)p=m=d[f];else if(e>p.Frame){let M=u,_=f;for(;M+1<_;){let T=M+_>>1;d[T].Frame<=e?M=T:_=T}p=d[M],m=d[_]}let x=p.Vector,g=m.Vector,y=typeof o=="number";if(p===m||t.LineType===0)return y?x[0]:Array.from(x);let v=Math.max(0,Math.min(1,(e-p.Frame)/(m.Frame-p.Frame)));if(a){let M=new Oe().fromArray(x).normalize(),_=new Oe().fromArray(g).normalize();if((t.LineType===2||t.LineType===3)&&p.OutTan&&m.InTan){let T=M.clone().slerp(_,v),P=new Oe().fromArray(p.OutTan).normalize().slerp(new Oe().fromArray(m.InTan).normalize(),v);return T.slerp(P,2*v*(1-v)).normalize().toArray()}return M.slerp(_,v).normalize().toArray()}let b=Array.from(x,(M,_)=>{if((t.LineType===2||t.LineType===3)&&p.OutTan&&m.InTan){let T=p.OutTan[_],P=m.InTan[_];return t.LineType===3?(1-v)**3*M+3*v*(1-v)**2*T+3*v*v*(1-v)*P+v**3*g[_]:(2*v**3-3*v*v+1)*M+(v**3-2*v*v+v)*T+(v**3-v*v)*P+(-2*v**3+3*v*v)*g[_]}return M+(g[_]-M)*v});return y?b[0]:b}function kp(t){let e={sequence:0,time:t.Sequences?.[0]?.Interval?.[0]||0,score:-1};for(let[n,i]of(t.Sequences||[]).entries()){let[r,s]=i.Interval;if(!(s>r))continue;let o=new Set(Array.from({length:8},(a,c)=>r+(s-r)*(c+1)/9));for(let a of t.ParticleEmitters2||[])if(a.Squirt)for(let c of a.EmissionRate?.Keys||[])c.Vector[0]>0&&c.Frame>=r&&c.Frame<s&&o.add(Math.min(s,c.Frame+Math.min(120,a.LifeSpan*500)));for(let a of o){let c=0;for(let h of t.ParticleEmitters2||[]){let l=(d,u=a)=>{let f=os(h[d],u,{interval:i.Interval,globalSequences:t.GlobalSequences,globalTime:u,fallback:d==="Visibility"?1:0});return Number(f?.[0]??f)};if(h.Squirt&&h.EmissionRate?.Keys){let d=t.GlobalSequences[h.EmissionRate.GlobalSeqId],u=d>0?a%d:a;for(let f of h.EmissionRate.Keys)u>=f.Frame&&u-f.Frame<h.LifeSpan*1e3&&l("Visibility",f.Frame)>0&&(c+=Math.max(0,f.Vector[0]))}else c+=Math.max(0,l("EmissionRate"))*Math.max(0,Math.min(h.LifeSpan,(a-r)/1e3))*(l("Visibility")>0?1:0)}for(let h of t.RibbonEmitters||[]){let l=os(h.Visibility,a,{interval:i.Interval,globalSequences:t.GlobalSequences,globalTime:a,fallback:0});Number(l?.[0]??l)>0&&(c+=Math.max(0,h.EmissionRate*Math.min(h.LifeSpan,(a-r)/1e3)))}c>e.score&&(e={sequence:n,time:a,score:c})}}return e}export{kp as activeParticleSample,bi as effectNodes,Ou as extractParticleRecipe,rn as openDocument,Vu as validateParticleRecipe};
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
