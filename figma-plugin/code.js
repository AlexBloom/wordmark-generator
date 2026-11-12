figma.showUI(__html__, { width: 400, height: 320 });
figma.ui.onmessage = async message => {
  if (message.type !== 'import' || !Array.isArray(message.files)) return;
  const nodes = [];
  try {
    for (const [index, file] of message.files.entries()) {
      if (typeof file.svg !== 'string' || !file.svg.trim().startsWith('<svg')) throw new Error('Choose SVG exports from Wordmark Generator.');
      const node = figma.createNodeFromSvg(file.svg); node.name = file.name || 'Wordmark';
      node.x = (index % 3) * 960; node.y = Math.floor(index / 3) * 660; figma.currentPage.appendChild(node); nodes.push(node);
    }
    figma.currentPage.selection = nodes; figma.viewport.scrollAndZoomIntoView(nodes);
    figma.notify(`Imported ${nodes.length} wordmark SVG${nodes.length === 1 ? '' : 's'}`);
    figma.closePlugin();
  } catch (error) { for (const node of nodes) node.remove(); figma.ui.postMessage({ error: error.message }); }
};
