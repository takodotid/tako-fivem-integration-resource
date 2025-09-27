# Tako's FiveM Integration Resource

This resource provides integration handler for Tako's partnered FiveM servers.

## Features

1. **Playtime Tracking**: Automatically tracks and updates connected Tako users' playtime on the server.
2. **Account Linking**: Allows users to link their Tako account with their FiveM server account for seamless integration with `/tako connect <code>` command, or check their connection status with `/tako info`.

## Installation

1. Clone this repository into your FiveM resources directory and rename it to `tako`:
    ```bash
     git clone git@github.com:takodotid/tako-fivem-integration-resource.git tako
    ```
2. Add `ensure tako` to your `server.cfg` file to ensure the resource starts with your server, the order does not matter.
3. Add the following convar to your `server.cfg`, replacing `your_server_id` with the server ID provided by Tako:
    ```bash
    set tako_server_id "your_server_id"
    ```
4. Start/restart your FiveM server.
5. Verify that the resource is running by checking the server console for any errors related to the `tako` resource.

## Notes

To ensure this script works properly, make sure that your server has access to the internet to communicate with Tako's FiveM integration API.

In order to use this resource, your server must be a registered partner with Tako. If you are interested in partnering with Tako, please contact us through our [Discord](https://discord.gg/tako) or at https://help.tako.id.

---

> Copyright (c) 2025 PT Hobimu Jadi Cuan, trademark owner of Tako. All rights reserved. \
> Please refer to the [LICENSE](./LICENSE) file for more information.
