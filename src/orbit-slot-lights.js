import * as THREE from 'three';

// Call after each scene owns its geometry and materials. The source GLB combines
// the 12 top slots, speaker cavity and bottom gasket into this one indexed mesh.
export function addSlotLights(root) {
  root.userData.slotCount = 0;
  const mesh = root.getObjectByName('UFO_BlackGasket');
  if (!mesh?.isMesh || !mesh.geometry.index) return [];

  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const indices = geometry.index;
  const blackMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!position || !blackMaterial) return [];

  const groups = [];
  const usedSlots = new Set();
  const centers=Array.from({length:12},()=>({sum:new THREE.Vector3(),count:0}));
  for (let start = 0; start < indices.count; start += 3) {
    const a = indices.getX(start);
    const b = indices.getX(start + 1);
    const c = indices.getX(start + 2);
    // BufferAttribute getters decode the model's normalized Int16 positions.
    const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
    // Only the top slots extend this far from the center in mesh-local space.
    const slot = Math.hypot(x, z) > .75
      ? (Math.round(Math.atan2(z, x) / (Math.PI / 6)) + 12) % 12
      : -1;
    const materialIndex = slot + 1;
    if (slot >= 0) {
      usedSlots.add(slot);
      centers[slot].sum.add(new THREE.Vector3(x,(position.getY(a)+position.getY(b)+position.getY(c))/3,z));
      centers[slot].count++;
    }
    const previous = groups.at(-1);
    if (previous?.materialIndex === materialIndex) previous.count += 3;
    else groups.push({start, count: 3, materialIndex});
  }
  if (!usedSlots.size) return [];

  const materials = [blackMaterial];
  const leds = [];
  root.updateMatrixWorld(true);
  const saucer=root.getObjectByName('UFO');
  for (let slot = 0; slot < 12; slot++) {
    // Unused material indices retain the original finish, without extra objects.
    if (!usedSlots.has(slot)) {
      materials.push(blackMaterial);
      continue;
    }
    const material = new THREE.MeshStandardMaterial({
      name: `UFO_TopSlot_Blue_${slot + 1}`,
      color: 0x087bff,
      emissive: 0x0088ff,
      emissiveIntensity: 1.8,
      metalness: .08,
      roughness: .22,
      side: blackMaterial.side,
      toneMapped: false,
    });
    materials.push(material);
    const center=centers[slot].sum.divideScalar(centers[slot].count);
    mesh.localToWorld(center);saucer.worldToLocal(center);center.y+=.00015;
    leds.push({material, phase: slot * Math.PI / 6, slot: true, position:center});
  }

  geometry.clearGroups();
  for (const group of groups) {
    geometry.addGroup(group.start, group.count, group.materialIndex);
  }
  mesh.material = materials;
  root.userData.slotCount = leds.length;
  return leds;
}
