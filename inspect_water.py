import bpy, os
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.expanduser("~/tipner-viewer/public/tipner.glb"))

# Get overall center for the centering offset
all_objs = [o for o in bpy.data.objects if o.type == 'MESH']
mn = [float('inf')]*3
mx = [float('-inf')]*3
for obj in all_objs:
    for c in obj.bound_box:
        wc = obj.matrix_world @ Vector(c)
        for i in range(3): mn[i]=min(mn[i],wc[i]); mx[i]=max(mx[i],wc[i])
center = Vector(((mn[i]+mx[i])/2 for i in range(3)))
print(f"Scene center: {center}")

# Find water and key meshes
for obj in bpy.data.objects:
    if obj.type != 'MESH': continue
    mats = [s.material.name if s.material else 'None' for s in obj.material_slots]
    if any(m in ['Water','Concrete','Hardstand','Grass','Ground'] for m in mats):
        bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        ymin = min(v.z for v in bb)  # Blender Z = Three.js Y
        ymax = max(v.z for v in bb)
        ymid = (ymin+ymax)/2
        # After centering: subtract center.z
        print(f"  {obj.name} (mat={mats}): Z={ymin:.1f}..{ymax:.1f}, centered Y={ymin-center.z:.1f}..{ymax-center.z:.1f}")
