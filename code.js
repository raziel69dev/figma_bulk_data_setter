figma.showUI(__html__, { width: 600, height: 600 });


const proxyUrl = 'https://figma-proxy-mpbg.onrender.com/image?url=';

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'apply-data') {
    const fields = msg.fields;
    const componentName = msg.componentLayer;
    const frameName = msg.targetFrame;

    const component = figma.currentPage.findOne(n => n.name === componentName);
    const frame = figma.currentPage.findOne(n => n.name === frameName);

    if (!component) return figma.notify('Component not found');
    if (!frame) return figma.notify('Frame not found');

    let maxRows = 0;
    fields.forEach(f => { if(f.values) maxRows = Math.max(maxRows, f.values.length) });

    for (let i = 0; i < maxRows; i++) {
      const clone = component.clone();
      frame.appendChild(clone);

      for (let field of fields) {
        const target = clone.findOne(n => n.name === field.name);
        if (!target) continue;

        let value = (field.values[i] !== undefined && field.values[i] !== '') ? field.values[i] : 'EMPTY DATA, RE-CHECK';

        if (field.type === 'text') {
          if (target.type === 'TEXT') {
            await figma.loadFontAsync(target.fontName);
            target.characters = value;
          }
        } else if (field.type === 'image') {
          if (target.fills) {
            try {
              const res = await fetch(proxyUrl + encodeURIComponent(value));
              const buffer = new Uint8Array(await res.arrayBuffer());
              const image = figma.createImage(buffer);
              target.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
            } catch(e) {
              console.error('Error image upload, check proxy server', e);
            }
          }
        }
      }
    }
    figma.notify('Success!');
    figma.closePlugin();
  }
};
