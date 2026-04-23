"""Inspect GLB model materials and meshes."""
import bpy, os
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.expanduser("~/tipner-viewer/public/tipner.glb"))
print("\n=== MATERIALS ===")
for mat in bpy.data.materials:
    print(f"  {mat.name}")
    if mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                bc = node.inputs['Base Color'].default_value
                print(f"    color: ({bc[0]:.2f}, {bc[1]:.2f}, {bc[2]:.2f})")
                print(f"    metallic: {node.inputs['Metallic'].default_value:.2f}")
                print(f"    roughness: {node.inputs['Roughness'].default_value:.2f}")
print("\n=== MESHES ===")
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        mats = [s.material.name if s.material else 'None' for s in obj.material_slots]
        print(f"  {obj.name}: materials={mats}")
