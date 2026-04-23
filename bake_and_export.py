"""
Bake all procedural textures to images, assign them to materials, and export GLB.
Run with: blender tipner_v45.blend --background --python bake_and_export.py
"""
import bpy
import os

GLB_OUT = os.path.expanduser("~/tipner-viewer/public/tipner.glb")
BAKE_SIZE = 1024

# Materials that have procedural nodes to bake
BAKE_MATERIALS = [
    "Concrete", "Hardstand", "Grass", "Brick", "Roof",
    "Water", "Tarmac", "Road", "Pile", "Dolphin",
]
# Add all pontoon variants
for i in range(20):
    key = "Pontoon" if i == 0 else f"Pontoon.{i:03d}"
    if key in [m.name for m in bpy.data.materials]:
        BAKE_MATERIALS.append(key)

# Switch to Cycles for baking (EEVEE can't bake)
bpy.context.scene.render.engine = "CYCLES"
bpy.context.scene.cycles.device = "CPU"
bpy.context.scene.cycles.samples = 16
bpy.context.scene.cycles.use_denoising = False


def ensure_uv(obj):
    """Make sure the mesh has a UV map."""
    if not obj.data.uv_layers:
        obj.data.uv_layers.new(name="BakeUV")
    return obj.data.uv_layers[0]


def bake_material(mat_name):
    """Bake a material's procedural textures to an image and rewire the shader."""
    mat = bpy.data.materials.get(mat_name)
    if not mat or not mat.use_nodes:
        print(f"  Skipping {mat_name}: no nodes")
        return

    tree = mat.node_tree
    bsdf = None
    for node in tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            bsdf = node
            break
    if not bsdf:
        print(f"  Skipping {mat_name}: no Principled BSDF")
        return

    # Find all objects using this material
    objs = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            if slot.material and slot.material.name == mat_name:
                objs.append(obj)
                break

    if not objs:
        print(f"  Skipping {mat_name}: no objects use it")
        return

    # Ensure UVs on all objects
    for obj in objs:
        ensure_uv(obj)

    # Create bake target image
    img_name = f"bake_{mat_name}"
    if img_name in bpy.data.images:
        bpy.data.images.remove(bpy.data.images[img_name])
    img = bpy.data.images.new(img_name, BAKE_SIZE, BAKE_SIZE, alpha=False)

    # Add image texture node for bake target
    img_node = tree.nodes.new("ShaderNodeTexImage")
    img_node.image = img
    img_node.location = (400, 0)
    img_node.select = True
    tree.nodes.active = img_node

    # Select objects for baking
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

    # Bake diffuse color (no direct/indirect, just color)
    try:
        bpy.ops.object.bake(
            type="DIFFUSE",
            pass_filter={"COLOR"},
            use_clear=True,
            margin=4,
        )
        print(f"  Baked color: {mat_name}")
    except Exception as e:
        print(f"  Bake failed for {mat_name}: {e}")
        tree.nodes.remove(img_node)
        return

    # Pack the image into the .blend
    img.pack()

    # Now rewire: disconnect all nodes going into Base Color, connect the baked image instead
    # First, remove links to Base Color
    for link in list(tree.links):
        if link.to_socket == bsdf.inputs["Base Color"]:
            tree.links.remove(link)

    # Connect baked image to Base Color
    tree.links.new(img_node.outputs["Color"], bsdf.inputs["Base Color"])

    # Remove the procedural nodes (keep the image node and BSDF)
    # We'll keep bump/normal nodes as they add detail
    # Just remove color-chain nodes that fed into Base Color
    img_node.select = False


print("Baking procedural textures to images...")
for mat_name in BAKE_MATERIALS:
    bake_material(mat_name)

# Switch back to EEVEE for viewport
bpy.context.scene.render.engine = "BLENDER_EEVEE"

# Save
blend_out = os.path.join(
    os.path.expanduser("~/Library/Mobile Documents/com~apple~CloudDocs/"
    "Foreland Group/Shipyard Group/Tipner"),
    "tipner_v45.blend"
)
bpy.ops.wm.save_as_mainfile(filepath=blend_out)
print(f"Saved: {blend_out}")

# Export GLB with textures
bpy.ops.export_scene.gltf(
    filepath=GLB_OUT,
    export_format="GLB",
    export_materials="EXPORT",
    export_image_format="AUTO",
)
print(f"Exported: {GLB_OUT}")

# Check file size
size_mb = os.path.getsize(GLB_OUT) / (1024 * 1024)
print(f"GLB size: {size_mb:.1f} MB")
print("Done.")
