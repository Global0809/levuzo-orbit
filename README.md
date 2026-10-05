# Levuzo Orbit

A responsive, live-3D product storefront for a levitating aluminum Bluetooth speaker. Four views use the supplied model: cinematic hero, product explorer, blue-hour close-up, and day/night atmosphere. No product photographs are rendered.

## Run locally

```sh
npm ci
npm run build
npm run check
npm run dev
```

The local preview runs at http://127.0.0.1:5182. Publish the contents of `dist/` to a static host. Paths are relative so subdirectory hosting works.

## Motion and mobile

- The saucer sits 1.5 cm above its original model position; the pedestal stays fixed.
- The UFO rotates clockwise independently at 1.05 radians/second. Camera paths use distinct slower rates so rotation remains visible.
- Twelve actual top slots and underside LEDs use an opposing-beacon blue chase. The stand stays brightly illuminated.
- Lightweight expanding 3D rings visualize sound around the saucer. They are artistic graphics, not acoustic measurement data.
- One shared 1.48 MB GLB download, lazy scene initialization, offscreen/background suspension, adaptive pixel density, no bloom or shadow postprocessing.
- Drag in any direction inside a model to rotate it immediately. Each view has a Touch: Rotate / Touch: Scroll switch; scrolling also works outside the canvas, and native pinch zoom is retained. Camera motion pauses during dragging, holds the chosen angle for 1.8 seconds, then eases back. Controls have 44 px phone targets.
- Reduced-motion preference starts all scenes paused. Each scene provides pause, replay and light controls, keyboard navigation and a WebGL error state.

`src/orbit-hero.js` owns scene lifecycle and effects. `src/orbit-input.js` handles pointer gestures; `src/orbit-camera-paths.js` authors the close-ups, crane passes, overhead spirals and wide returns. `src/orbit-slot-lights.js` isolates the model's top-slot material groups. `scripts/theme-baseline.json` protects the original theme styles. Run the input regression and static checks after changes.

## Audio field

The `#sound-field` section uses a lightweight Canvas 2D wire field, polar wavefronts and signal trace. Full spectrum, Low end and High detail change the artistic illustration; no acoustic measurements, recorded audio or microphone input are used. A visible caption identifies the graphic as illustrative. `dist/orbit-audio.js` runs at up to 30fps with capped pixel density, pauses offscreen/in background, supports reduced motion and provides a pause control. Phone scrolling remains native across the graph. Its styles live in `dist/orbit-audio.css`.

## Ordering status

Checkout remains disabled until a verified merchant-hosted payment link and actual shipping/return terms are supplied. The site does not accept orders, charge cards, collect addresses or store card information. The displayed prices are $249 launch / $999 standard. No fake stock counter is used.

## Assets and dependencies

The model was supplied for this project. Third-party software retains its own licenses: Three.js and GSAP notices ship in `dist/vendor/` and alongside the generated bundle. Outfit fonts and the existing theme are retained. No license to redistribute the product model, branding or other proprietary assets beyond this project is granted by this README.
