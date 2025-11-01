 import OBR from "@owlbear-rodeo/sdk";

const ID = "com.yourname.token-notes"; 

OBR.onReady(() => {
  OBR.contextMenu.create({
    id: `${ID}/menu`,
    icons: [
      {
        icon: "/icon.png", 
        label: "Token Note",
        filter: {
          every: [{ key: "layer", value: "CHARACTER" }], 
        },
      },
    ],
    onClick(context) {
      const selectedItem = context.items[0];
      if (selectedItem) {
        OBR.popover.open({
          id: `${ID}/popover`,
          url: `/index.html`, 
          width: 300,
          height: 400,
          anchorElementId: selectedItem.id, 
        });
      }
    },
  });
});