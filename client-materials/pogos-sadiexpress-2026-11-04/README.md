# Pogo’s menu and image capture

Captured **04 November 2026, 00:37 CAT** from [Pogo’s on SadieXpress](https://delivery.sadiexpress.com/en/harare/vendor/1067). The listing identifies **Kamfinsa Shopping Centre, Greendale, Harare**. This capture describes that listing; it does not establish matching menus/prices for Msasa or Westgate.

Open **[index.html](index.html)** for the searchable offline catalogue, full-resolution images, category filters, options and download links.

## Contents

- **51 menu items in nine categories**, including the four items marked unavailable.
- **44 product-photo assignments**, with 43 distinct photo contents: Small Chips and Large Chips share the same photograph.
- **184 published image variants downloaded successfully**: 176 menu variants, three logo variants and five header variants.
- **51 item dialogs inspected**, with descriptions and the three size/flavour/preparation option groups captured. There are ten unique choices and 60 item-to-option rows.
- The nine “Most ordered” entries are references to existing menu items, not extra products.

| File/folder | What it contains |
| --- | --- |
| [menu.csv](menu.csv) | Spreadsheet-ready menu, descriptions, displayed USD prices, availability, photo paths and source links |
| [menu-options.csv](menu-options.csv) | Item-level options, required/default flags and additional prices |
| [menu.json](menu.json) | Structured catalogue, branch metadata, groups, image mappings and provenance |
| [menu.md](menu.md) | Complete readable menu and option summary |
| [images.csv](images.csv) | Every downloaded image URL, local path, dimensions and SHA-256 |
| [image-downloads.json](image-downloads.json) | Download results, MIME types, dimensions, hashes and unavailable base-URL attempts |
| [images/branding/pogos-logo.webp](images/branding/pogos-logo.webp) | Largest published standalone logo, **234 × 234** |
| [images/branding/pogos-header-wide.webp](images/branding/pogos-header-wide.webp) | Branded header, **1920 × 500** |
| [images/branding/pogos-header-1200x630.webp](images/branding/pogos-header-1200x630.webp) | Alternate header crop, **1200 × 630** |
| images/menu/ | Descriptively named copies of the largest published menu images, **900 pixels wide** |
| images/variants/ | All 184 published resolutions, as served, without conversion or upscaling |
| [source/catalogue-page.json](source/catalogue-page.json) | Complete public catalogue response used by the listing |
| [source/rendered-menu.txt](source/rendered-menu.txt) | Initial rendered page text, including featured duplicates |
| source/item-dialogs/ | One captured item dialog per product |
| [source/related-pogos-listings.json](source/related-pogos-listings.json) | Pogo’s result from the public Harare directory |
| [gallery-check.json](gallery-check.json) | Offline gallery and desktop/mobile verification |
| [capture-report.json](capture-report.json) | Coverage, validation results and missing-image list |
| [SHA256SUMS.txt](SHA256SUMS.txt) | Integrity hashes for every file in this capture |

## Coverage and source interpretation

The catalogue exposes nine complete category groups with 51 unique product IDs. All 51 are also present in the rendered menu and were checked through their item-detail URL. Item dialogs were closed between products so option state could not carry across products. Captured dialog text and public catalogue option groups agree. The public Harare directory was also checked: its Pogo’s result is vendor 1067 with the same menu-listing logo/header descriptors; no additional Pogo’s artwork was exposed there.

All advertised Pogo’s image variants returned valid images and were decoded/verified. The unmodified image base URLs returned HTTP 403; the pack therefore uses the published variants and makes no claim to contain original uploads. Product dialogs exposed no additional Pogo’s product photographs. Generic platform placeholder art is not counted as a menu photo. The locality-wide promotional banners shown on the page are not labelled as Pogo’s artwork and are excluded from the image collection; their original descriptors remain in the unedited catalogue response.

API vendor **1067** uses CDN image paths containing legacy vendor **1581**; that mapping comes directly from the listing response. Both IDs are retained rather than inferred to represent different branches.

The displayed USD prices are marketplace prices at capture time. The API’s separate `originalPrice` values are preserved under `api_original_price` without assuming they are approved till/direct-order prices. The venue was outside its immediate ordering window when captured; catalogue availability flags and preorder/working-hour metadata are retained separately. No stock or trading promise is inferred from them. These materials remain reference inputs for client review.

## Items with no supplied photograph

- Mediterranean Pizza (PIZZAS)
- Pogo Dew Pizza (Tweaked) (PIZZAS)
- Chicken Bites (AWESOME CHICKEN)
- Tandoori Wrapper (WICKED WRAPS)
- Hawaiian Wrapper (WICKED WRAPS)
- Chicken Bites Meal Deal (COMBOS)
- Malva Pudding (DESSERTS)

No replacement imagery was invented for these seven products. The existing application, database and integrations were not changed by this capture.
