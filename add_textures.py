"""
Add procedural textures to all materials in the Tipner shipyard model.
Run with: blender tipner_v44.blend --background --python add_textures.py

Saves as tipner_v45.blend and exports tipner_v45.glb.
"""
import bpy
import os
from mathutils import Vector

OUT_DIR = os.path.expanduser(
    "~/Library/Mobile Documents/com~apple~CloudDocs/"
    "Foreland Group/Shipyard Group/Tipner"
)
GLB_OUT = os.path.expanduser("~/tipner-viewer/public/tipner.glb")


def get_or_create_nodes(mat):
    """Ensure material uses nodes and return (node_tree, principled_bsdf)."""
    mat.use_nodes = True
    tree = mat.node_tree
    bsdf = None
    for node in tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            bsdf = node
            break
    return tree, bsdf


def add_tex_coord(tree):
    """Add a Texture Coordinate node if not present."""
    for n in tree.nodes:
        if n.type == "TEX_COORD":
            return n
    tc = tree.nodes.new("ShaderNodeTexCoord")
    tc.location = (-1200, 0)
    return tc


def add_mapping(tree, tc, scale=(1, 1, 1), loc=(-900, 0)):
    """Add a Mapping node connected to tex coord Object output."""
    m = tree.nodes.new("ShaderNodeMapping")
    m.location = loc
    m.inputs["Scale"].default_value = scale
    tree.links.new(tc.outputs["Object"], m.inputs["Vector"])
    return m


# ---- TEXTURE BUILDERS ----

def texture_concrete(mat):
    tree, bsdf = get_or_create_nodes(mat)
    if not bsdf:
        return
    tc = add_tex_coord(tree)
    mapping = add_mapping(tree, tc, scale=(0.05, 0.05, 0.05))

    # Base color: noise for variation
    noise1 = tree.nodes.new("ShaderNodeTexNoise")
    noise1.location = (-600, 200)
    noise1.inputs["Scale"].default_value = 80
    noise1.inputs["Detail"].default_value = 8
    noise1.inputs["Roughness"].default_value = 0.6
    tree.links.new(mapping.outputs["Vector"], noise1.inputs["Vector"])

    # Color ramp for concrete tones
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-300, 200)
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.52, 0.50, 0.47, 1)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = (0.68, 0.66, 0.62, 1)
    tree.links.new(noise1.outputs["Fac"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])

    # Roughness variation
    noise2 = tree.nodes.new("ShaderNodeTexNoise")
    noise2.location = (-600, -100)
    noise2.inputs["Scale"].default_value = 120
    noise2.inputs["Detail"].default_value = 4
    tree.links.new(mapping.outputs["Vector"], noise2.inputs["Vector"])

    ramp2 = tree.nodes.new("ShaderNodeValToRGB")
    ramp2.location = (-300, -100)
    ramp2.color_ramp.elements[0].position = 0.3
    ramp2.color_ramp.elements[0].color = (0.78, 0.78, 0.78, 1)
    ramp2.color_ramp.elements[1].position = 0.8
    ramp2.color_ramp.elements[1].color = (0.95, 0.95, 0.95, 1)
    tree.links.new(noise2.outputs["Fac"], ramp2.inputs["Fac"])
    tree.links.new(ramp2.outputs["Color"], bsdf.inputs["Roughness"])

    # Bump for surface detail
    noise3 = tree.nodes.new("ShaderNodeTexNoise")
    noise3.location = (-600, -400)
    noise3.inputs["Scale"].default_value = 200
    noise3.inputs["Detail"].default_value = 10
    noise3.inputs["Roughness"].default_value = 0.7
    tree.links.new(mapping.outputs["Vector"], noise3.inputs["Vector"])

    bump = tree.nodes.new("ShaderNodeBump")
    bump.location = (-200, -400)
    bump.inputs["Strength"].default_value = 0.15
    tree.links.new(noise3.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def texture_hardstand(mat):
    tree, bsdf = get_or_create_nodes(mat)
    if not bsdf:
        return
    tc = add_tex_coord(tree)
    mapping = add_mapping(tree, tc, scale=(0.04, 0.04, 0.04))

    # Weathered concrete with staining
    noise1 = tree.nodes.new("ShaderNodeTexNoise")
    noise1.location = (-600, 200)
    noise1.inputs["Scale"].default_value = 60
    noise1.inputs["Detail"].default_value = 10
    noise1.inputs["Roughness"].default_value = 0.65
    tree.links.new(mapping.outputs["Vector"], noise1.inputs["Vector"])

    # Stain layer
    noise_stain = tree.nodes.new("ShaderNodeTexNoise")
    noise_stain.location = (-600, 0)
    noise_stain.inputs["Scale"].default_value = 15
    noise_stain.inputs["Detail"].default_value = 3
    tree.links.new(mapping.outputs["Vector"], noise_stain.inputs["Vector"])

    mix = tree.nodes.new("ShaderNodeMixRGB")
    mix.location = (-300, 200)
    mix.blend_type = "MULTIPLY"
    mix.inputs["Fac"].default_value = 0.3
    mix.inputs["Color1"].default_value = (0.58, 0.55, 0.50, 1)
    mix.inputs["Color2"].default_value = (0.45, 0.42, 0.38, 1)
    tree.links.new(noise_stain.outputs["Fac"], mix.inputs["Fac"])

    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-300, 50)
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.48, 0.46, 0.42, 1)
    ramp.color_ramp.elements[1].position = 0.65
    ramp.color_ramp.elements[1].color = (0.62, 0.60, 0.56, 1)
    tree.links.new(noise1.outputs["Fac"], ramp.inputs["Fac"])

    mix2 = tree.nodes.new("ShaderNodeMixRGB")
    mix2.location = (-100, 200)
    mix2.inputs["Fac"].default_value = 0.5
    tree.links.new(ramp.outputs["Color"], mix2.inputs["Color1"])
    tree.links.new(mix.outputs["Color"], mix2.inputs["Color2"])
    tree.links.new(mix2.outputs["Color"], bsdf.inputs["Base Color"])

    bsdf.inputs["Roughness"].default_value = 0.9

    # Bump
    noise_b = tree.nodes.new("ShaderNodeTexNoise")
    noise_b.location = (-600, -400)
    noise_b.inputs["Scale"].default_value = 150
    noise_b.inputs["Detail"].default_value = 12
    tree.links.new(mapping.outputs["Vector"], noise_b.inputs["Vector"])

    bump = tree.nodes.new("ShaderNodeBump")
    bump.location = (-200, -400)
    bump.inputs["Strength"].default_value = 0.12
    tree.links.new(noise_b.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def texture_grass(mat):
    tree, bsdf = get_or_create_nodes(mat)
    if not bsdf:
        return
    tc = add_tex_coord(tree)
    mapping = add_mapping(tree, tc, scale=(0.03, 0.03, 0.03))

    # Multi-octave grass color
    noise1 = tree.nodes.new("ShaderNodeTexNoise")
    noise1.location = (-600, 200)
    noise1.inputs["Scale"].default_value = 100
    noise1.inputs["Detail"].default_value = 12
    noise1.inputs["Roughness"].default_value = 0.7
    tree.links.new(mapping.outputs["Vector"], noise1.inputs["Vector"])

    # Clumping pattern
    voronoi = tree.nodes.new("ShaderNodeTexVoronoi")
    voronoi.location = (-600, 0)
    voronoi.inputs["Scale"].default_value = 40
    tree.links.new(mapping.outputs["Vector"], voronoi.inputs["Vector"])

    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-300, 200)
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.15, 0.28, 0.08, 1)
    e = ramp.color_ramp.elements.new(0.5)
    e.color = (0.22, 0.40, 0.12, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (0.30, 0.50, 0.18, 1)
    tree.links.new(noise1.outputs["Fac"], ramp.inputs["Fac"])

    # Mix with clump darkening
    mix = tree.nodes.new("ShaderNodeMixRGB")
    mix.location = (-100, 200)
    mix.blend_type = "MULTIPLY"
    mix.inputs["Fac"].default_value = 0.2
    tree.links.new(ramp.outputs["Color"], mix.inputs["Color1"])
    tree.links.new(voronoi.outputs["Distance"], mix.inputs["Color2"])
    tree.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])

    bsdf.inputs["Roughness"].default_value = 0.95

    # Bump for blade texture
    noise_b = tree.nodes.new("ShaderNodeTexNoise")
    noise_b.location = (-600, -400)
    noise_b.inputs["Scale"].default_value = 300
    noise_b.inputs["Detail"].default_value = 8
    tree.links.new(mapping.outputs["Vector"], noise_b.inputs["Vector"])

    bump = tree.nodes.new("ShaderNodeBump")
    bump.location = (-200, -400)
    bump.inputs["Strength"].default_value = 0.2
    tree.links.new(noise_b.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def texture_brick(mat):
    tree, bsdf = get_or_create_nodes(mat)
    if not bsdf:
        return
    tc = add_tex_coord(tree)
    mapping = add_mapping(tree, tc, scale=(0.15, 0.15, 0.15))

    # Brick texture node
    brick = tree.nodes.new("ShaderNodeTexBrick")
    brick.location = (-600, 200)
    brick.inputs["Color1"].default_value = (0.52, 0.30, 0.22, 1)
    brick.inputs["Color2"].default_value = (0.60, 0.38, 0.28, 1)
    brick.inputs["Mortar"].default_value = (0.72, 0.70, 0.65, 1)
    brick.inputs["Scale"].default_value = 12
    brick.inputs["Mortar Size"].default_value = 0.015
    brick.inputs["Bias"].default_value = 0.0
    tree.links.new(mapping.outputs["Vector"], brick.inputs["Vector"])

    # Add noise to brick color
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.location = (-600, -50)
    noise.inputs["Scale"].default_value = 80
    noise.inputs["Detail"].default_value = 6
    tree.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    mix = tree.nodes.new("ShaderNodeMixRGB")
    mix.location = (-300, 200)
    mix.blend_type = "OVERLAY"
    mix.inputs["Fac"].default_value = 0.15
    tree.links.new(brick.outputs["Color"], mix.inputs["Color1"])
    tree.links.new(noise.outputs["Color"], mix.inputs["Color2"])
    tree.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])

    bsdf.inputs["Roughness"].default_value = 0.85

    # Bump from brick pattern
    bump = tree.nodes.new("ShaderNodeBump")
    bump.location = (-200, -300)
    bump.inputs["Strength"].default_value = 0.3
    tree.links.new(brick.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def texture_wood(mat):
    """Timber/composite pontoon decking."""
    tree, bsdf = get_or_create_nodes(mat)
    if not bsdf:
        return
    tc = add_tex_coord(tree)
    mapping = add_mapping(tree, tc, scale=(0.2, 0.2, 0.2))

    # Wave texture for wood grain
    wave = tree.nodes.new("ShaderNodeTexWave")
    wave.location = (-600, 200)
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.inputs["Scale"].default_value = 3
    wave.inputs["Distortion"].default_value = 4
    wave.inputs["Detail"].default_value = 6
    wave.inputs["Detail Scale"].default_value = 2
    tree.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])

    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-300, 200)
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.35, 0.24, 0.15, 1)
    e = ramp.color_ramp.elements.new(0.5)
    e.color = (0.45, 0.32, 0.20, 1)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = (0.55, 0.40, 0.26, 1)
    tree.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])

    # Weathering noise overlay
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.location = (-600, -50)
    noise.inputs["Scale"].default_value = 40
    noise.inputs["Detail"].default_value = 5
    tree.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    mix = tree.nodes.new("ShaderNodeMixRGB")
    mix.location = (-100, 200)
    mix.blend_type = "OVERLAY"
    mix.inputs["Fac"].default_value = 0.2
    tree.links.new(ramp.outputs["Color"], mix.inputs["Color1"])
    tree.links.new(noise.outputs["Color"], mix.inputs["Color2"])
    tree.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])

    bsdf.inputs["Roughness"].default_value = 0.75

    # Bump for grain
    bump = tree.nodes.new("ShaderNodeBump")
    bump.location = (-200, -300)
    bump.inputs["Strength"].default_value = 0.15
    tree.links.new(wave.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def texture_tarmac(mat):
    tree, bsdf = get_or_create_nodes(mat)
    if not bsdf:
        return
    tc = add_tex_coord(tree)
    mapping = add_mapping(tree, tc, scale=(0.05, 0.05, 0.05))

    # Aggregate noise
    noise1 = tree.nodes.new("ShaderNodeTexNoise")
    noise1.location = (-600, 200)
    noise1.inputs["Scale"].default_value = 200
    noise1.inputs["Detail"].default_value = 12
    noise1.inputs["Roughness"].default_value = 0.8
    tree.links.new(mapping.outputs["Vector"], noise1.inputs["Vector"])

    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-300, 200)
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.08, 0.08, 0.08, 1)
    ramp.color_ramp.elements[1].position = 0.65
    ramp.color_ramp.elements[1].color = (0.18, 0.18, 0.17, 1)
    tree.links.new(noise1.outputs["Fac"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])

    bsdf.inputs["Roughness"].default_value = 0.88

    # Bump
    musgrave = tree.nodes.new("ShaderNodeTexNoise")
    musgrave.location = (-600, -300)
    musgrave.inputs["Scale"].default_value = 400
    musgrave.inputs["Detail"].default_value = 14
    tree.links.new(mapping.outputs["Vector"], musgrave.inputs["Vector"])

    bump = tree.nodes.new("ShaderNodeBump")
    bump.location = (-200, -300)
    bump.inputs["Strength"].default_value = 0.1
    tree.links.new(musgrave.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def texture_roof(mat):
    """Corrugated metal roofing."""
    tree, bsdf = get_or_create_nodes(mat)
    if not bsdf:
        return
    tc = add_tex_coord(tree)
    mapping = add_mapping(tree, tc, scale=(0.3, 0.3, 0.3))

    # Corrugation with wave
    wave = tree.nodes.new("ShaderNodeTexWave")
    wave.location = (-600, 200)
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.inputs["Scale"].default_value = 20
    wave.inputs["Distortion"].default_value = 0.5
    wave.inputs["Detail"].default_value = 2
    tree.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])

    # Base color with slight rust patches
    noise_rust = tree.nodes.new("ShaderNodeTexNoise")
    noise_rust.location = (-600, -50)
    noise_rust.inputs["Scale"].default_value = 12
    noise_rust.inputs["Detail"].default_value = 4
    tree.links.new(mapping.outputs["Vector"], noise_rust.inputs["Vector"])

    ramp_rust = tree.nodes.new("ShaderNodeValToRGB")
    ramp_rust.location = (-300, -50)
    ramp_rust.color_ramp.elements[0].position = 0.55
    ramp_rust.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp_rust.color_ramp.elements[1].position = 0.7
    ramp_rust.color_ramp.elements[1].color = (1, 1, 1, 1)
    tree.links.new(noise_rust.outputs["Fac"], ramp_rust.inputs["Fac"])

    mix = tree.nodes.new("ShaderNodeMixRGB")
    mix.location = (-100, 200)
    mix.inputs["Color1"].default_value = (0.42, 0.45, 0.48, 1)  # clean metal
    mix.inputs["Color2"].default_value = (0.45, 0.30, 0.18, 1)  # rust
    tree.links.new(ramp_rust.outputs["Color"], mix.inputs["Fac"])
    tree.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])

    bsdf.inputs["Metallic"].default_value = 0.4
    bsdf.inputs["Roughness"].default_value = 0.55

    # Bump from corrugation
    bump = tree.nodes.new("ShaderNodeBump")
    bump.location = (-200, -300)
    bump.inputs["Strength"].default_value = 0.4
    tree.links.new(wave.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def texture_water(mat):
    tree, bsdf = get_or_create_nodes(mat)
    if not bsdf:
        return
    tc = add_tex_coord(tree)
    mapping = add_mapping(tree, tc, scale=(0.01, 0.01, 0.01))

    # Ocean color with depth variation
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.location = (-600, 200)
    noise.inputs["Scale"].default_value = 8
    noise.inputs["Detail"].default_value = 6
    tree.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-300, 200)
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.12, 0.32, 0.50, 1)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = (0.20, 0.42, 0.58, 1)
    tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])

    bsdf.inputs["Roughness"].default_value = 0.05
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Specular IOR Level"].default_value = 0.5

    # Wave bump
    wave = tree.nodes.new("ShaderNodeTexWave")
    wave.location = (-600, -200)
    wave.wave_type = "BANDS"
    wave.inputs["Scale"].default_value = 4
    wave.inputs["Distortion"].default_value = 6
    wave.inputs["Detail"].default_value = 8
    wave.inputs["Detail Scale"].default_value = 1.5
    tree.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])

    noise2 = tree.nodes.new("ShaderNodeTexNoise")
    noise2.location = (-600, -450)
    noise2.inputs["Scale"].default_value = 30
    noise2.inputs["Detail"].default_value = 8
    tree.links.new(mapping.outputs["Vector"], noise2.inputs["Vector"])

    # Combine wave and ripple bumps
    bump1 = tree.nodes.new("ShaderNodeBump")
    bump1.location = (-200, -200)
    bump1.inputs["Strength"].default_value = 0.08
    tree.links.new(wave.outputs["Fac"], bump1.inputs["Height"])

    bump2 = tree.nodes.new("ShaderNodeBump")
    bump2.location = (-50, -350)
    bump2.inputs["Strength"].default_value = 0.04
    tree.links.new(noise2.outputs["Fac"], bump2.inputs["Height"])
    tree.links.new(bump1.outputs["Normal"], bump2.inputs["Normal"])
    tree.links.new(bump2.outputs["Normal"], bsdf.inputs["Normal"])


def texture_steel(mat):
    """Weathered steel for piles and dolphins."""
    tree, bsdf = get_or_create_nodes(mat)
    if not bsdf:
        return
    tc = add_tex_coord(tree)
    mapping = add_mapping(tree, tc, scale=(0.2, 0.2, 0.2))

    # Rust/clean patches
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.location = (-600, 200)
    noise.inputs["Scale"].default_value = 15
    noise.inputs["Detail"].default_value = 6
    tree.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])

    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-300, 200)
    ramp.color_ramp.elements[0].position = 0.4
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 0.6
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])

    mix = tree.nodes.new("ShaderNodeMixRGB")
    mix.location = (-100, 200)
    mix.inputs["Color1"].default_value = (0.50, 0.48, 0.45, 1)  # clean steel
    mix.inputs["Color2"].default_value = (0.42, 0.26, 0.14, 1)  # rust
    tree.links.new(ramp.outputs["Color"], mix.inputs["Fac"])
    tree.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])

    # Rust reduces metalness
    mix_metal = tree.nodes.new("ShaderNodeMixRGB")
    mix_metal.location = (-100, -50)
    mix_metal.inputs["Color1"].default_value = (0.8, 0.8, 0.8, 1)
    mix_metal.inputs["Color2"].default_value = (0.1, 0.1, 0.1, 1)
    tree.links.new(ramp.outputs["Color"], mix_metal.inputs["Fac"])
    tree.links.new(mix_metal.outputs["Color"], bsdf.inputs["Metallic"])

    bsdf.inputs["Roughness"].default_value = 0.45

    # Bump
    noise_b = tree.nodes.new("ShaderNodeTexNoise")
    noise_b.location = (-600, -400)
    noise_b.inputs["Scale"].default_value = 100
    noise_b.inputs["Detail"].default_value = 10
    tree.links.new(mapping.outputs["Vector"], noise_b.inputs["Vector"])

    bump = tree.nodes.new("ShaderNodeBump")
    bump.location = (-200, -400)
    bump.inputs["Strength"].default_value = 0.15
    tree.links.new(noise_b.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


# ---- APPLY TO MATERIALS ----

TEXTURE_MAP = {
    "Concrete": texture_concrete,
    "Hardstand": texture_hardstand,
    "Grass": texture_grass,
    "Brick": texture_brick,
    "Roof": texture_roof,
    "Water": texture_water,
    "Tarmac": texture_tarmac,
    "Road": texture_tarmac,
    "Pile": texture_steel,
    "Dolphin": texture_steel,
}

# Pontoons get wood
for i in range(20):
    key = "Pontoon" if i == 0 else f"Pontoon.{i:03d}"
    TEXTURE_MAP[key] = texture_wood

print("Applying procedural textures...")
for mat in bpy.data.materials:
    fn = TEXTURE_MAP.get(mat.name)
    if fn:
        print(f"  Texturing: {mat.name}")
        fn(mat)

# Save as v45
blend_out = os.path.join(OUT_DIR, "tipner_v45.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_out)
print(f"Saved: {blend_out}")

# Export GLB
bpy.ops.export_scene.gltf(
    filepath=GLB_OUT,
    export_format="GLB",
    export_materials="EXPORT",
    export_image_format="AUTO",
)
print(f"Exported: {GLB_OUT}")
print("Done.")
