# Realistic gym artwork

Generated with the built-in image generation tool. Production asset:
`public/art/gym/field-house-panorama.png` (2172 × 724).

The generated result is a wide photograph rather than a fully seamless spherical
capture. Its wall region now textures a fixed cylindrical gym perimeter, and a
separate top-down oak photograph textures a world-space floor mesh. The actual circling camera
projects both surfaces with perspective, including advance, retreat, slips and
movement away from center. Near-plane clipping prevents flips; a structural
upright covers the photograph's edge join. This is photographic texture mapping,
not a reconstruction of every object in the source photograph.

Fighters, animations, gameplay, and HUD meters remain separate. The renderer
restores nearest-neighbor sampling after drawing room textures. `material-grain.svg`
supplies procedural surface grain to CSS materials; interface lettering remains
live bitmap text.

## Oak floor material

`public/art/gym/oak-floor-texture.png`, generated with the built-in image tool.
The separate orthographic material avoids baking the original room photograph's
floor perspective into the moving floor a second time.

Prompt: Use case: photorealistic-natural. Production game material texture: seamless tileable aged oak plank flooring from a 1940s military boxing gym. Orthographic straight-down overhead camera, completely flat planar texture, absolutely no perspective or vanishing point. Square 2048x2048 image. Long narrow wooden boards in consistent parallel alignment, rich warm medium brown, realistic grain, old varnish, subtle scuffs and occasional dark nail heads. Boards evenly sized with subtle staggered joins. Even neutral diffuse lighting, no shadows, sunlight, reflections, objects, room, people, borders or text. Tileable matching edges. Natural photographic material, no illustration or pixels. Avoid overly swirling grain, keep convincing straight timber planks.

## Generation prompt

Use case: photorealistic-natural. Asset type: production background panorama for a first person boxing video game, NO UI or characters. Create an ultra detailed realistic photograph of an empty old military field-house boxing gym, matching the atmosphere of the user's reference: aged olive green painted wainscoting and steel lockers, weathered plaster and brick, dark timber ceiling rafters, heavy brown leather punching bags on chains, vintage framed sepia boxing photographs, brass trophies, wooden benches and folded white towels. Rich worn wooden plank floor fills the lower 45 percent. Wide clear uncluttered center foreground for a separately composited boxer. Boxing ring with faded red ropes against the back wall, not across the foreground. Tall industrial multi-pane windows admit cinematic warm late afternoon sunlight and visible volumetric light shafts on the LEFT, realistic soft dust, warm hanging pendant lamps. Strong depth and believable scale. Photorealistic real leather, brass, wood grain, scratches, cloth; absolutely NO pixel art, NO illustration, NO low poly or flat cel shading. Camera at human eye level in the center of the gym, level horizon at about 40 percent image height, no fisheye. Extra wide 3:1 horizontally seamless cylindrical 360-degree room panorama, continuous floor and walls, no border, no readable typography, no logos, no watermark, no people, no gloves, no game UI. Olive, dark brown, aged brass and warm cream palette. Detailed room perimeter, central fighting space stays clear.
