// main plugin code
figma.showUI(__html__, { width: 760, height: 820 });

// When UI asks for components: respond with components from current page
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'requestComponents') {
    // Ensure pages loaded
    try {
      await figma.loadAllPagesAsync();
    } catch (e) {
      console.warn('loadAllPagesAsync failed', e);
    }
    // Get components and component sets on current page
    const comps = figma.currentPage.findAll(n => n.type === 'COMPONENT' || n.type === 'COMPONENT_SET');
    const list = comps.map(c => ({ id: c.id, name: c.name }));
    figma.ui.postMessage({ type: 'componentsList', components: list });
    return;
  }

  // Manual generation path
  if (msg.type === 'manual-grid') {
    const data = msg.data; // [{layer, type, values:[]}, ...]
    const grids = msg.grids; // [{name, positions}]
    const compId = msg.component;
    const templateNode = figma.getNodeById(compId);

    if (!templateNode) {
      figma.notify('Component not found on page.');
      return;
    }

    // If user passed an instance or a component set, try to use createInstance if possible
    const isComponent = templateNode.type === 'COMPONENT';
    const isComponentSet = templateNode.type === 'COMPONENT_SET';

    // determine maxLines (number of positions)
    const maxLines = data.length ? Math.max(...data.map(d => d.values.length)) : 0;
    figma.ui.postMessage({ type: 'updateTotal', total: maxLines });

    let dataIndex = 0;

    for (let gi = 0; gi < grids.length; gi++) {
      const grid = grids[gi];
      const frameNode = figma.currentPage.findOne(n => n.type === 'FRAME' && n.name === grid.name);

      if (!frameNode) {
        figma.notify(`Frame "${grid.name}" not found on page — skipping`);
        continue;
      }

      // how many to place in this frame
      let count = grid.positions || Infinity;
      // if last frame, take remaining
      if (gi === grids.length - 1) {
        count = Math.max(0, maxLines - dataIndex);
      }

      for (let i = 0; i < count && dataIndex < maxLines; i++, dataIndex++) {
        // create instance of component
        let clone;
        try {
          if (isComponent) {
            clone = templateNode.createInstance();
          } else if (isComponentSet) {
            // if it's a component set, pick first child component to instance
            const firstComp = templateNode.findOne(n => n.type === 'COMPONENT');
            if (firstComp) clone = firstComp.createInstance();
            else clone = templateNode.clone(); // fallback
          } else {
            // fallback: try clone
            clone = templateNode.clone();
          }
        } catch (e) {
          // fallback clone
          clone = templateNode.clone();
        }

        // append into frame
        frameNode.appendChild(clone);

        // place vertically, avoid overlap: position at number of children before placing
        const indexInFrame = frameNode.children.length - 1;
        const yOffset = (clone.height || 0) * indexInFrame + (20 * indexInFrame);
        clone.x = 0;
        clone.y = yOffset;

        // fill layers
        for (const layerDef of data) {
          const layerName = layerDef.layer;
          const type = layerDef.type;
          const values = layerDef.values;
          const val = (values[dataIndex] !== undefined) ? values[dataIndex] : '';

          if (!layerName) continue;
          // find target inside clone (search by name)
          const target = clone.findOne(n => n.name === layerName);
          if (!target) continue;

          // handle text
          if (type === 'text' && target.type === 'TEXT') {
            try {
              // load font; fontName may be object or string
              const fn = target.fontName;
              if (typeof fn === 'object') {
                await figma.loadFontAsync(fn);
              } else {
                await figma.loadFontAsync(fn);
              }
            } catch (e) {
              // font load failed — try generic fallback, but continue
              console.warn('Font load failed for', target, e);
            }
            try {
              target.characters = val || '';
            } catch (e) {
              console.warn('Failed to set text for', target.name, e);
            }
          }

          // handle image
          else if (type === 'image' && 'fills' in target) {
            if (!val || !val.startsWith('http')) {
              // nothing to load — skip
              continue;
            }
            try {
              const proxyBase = 'https://figma-proxy-mpbg.onrender.com/?url=';
              const proxyUrl = proxyBase + encodeURIComponent(val);
              const res = await fetch(proxyUrl);
              if (!res.ok) throw new Error('Image fetch failed: ' + res.status);
              const arr = new Uint8Array(await res.arrayBuffer());
              const imageHash = figma.createImage(arr).hash;
              const newFills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash }];
              target.fills = newFills;
            } catch (e) {
              console.warn('Failed to load image for', layerName, e);
              // leave fills as-is
            }
          }
        } // end fill layers
      } // end count loop
    } // end grids loop

    figma.notify(`Generated ${maxLines} components`);
    // select created nodes? we appended clones inside frames so let's select last created children across frames
    // (skipped for simplicity)
  }
};
