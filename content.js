let processedPageHeight = window.innerHeight;

  

  //region event listeners


    document.addEventListener('DOMContentLoaded', () => {
    // Find empty spaces on the page
    findEmptySpaces();
  });

  window.addEventListener('load', () => {
    // Add a slight delay to allow for dynamic content to render
    setTimeout(() => {
      const whitespaces = findWhiteSpaces();
      whitespaces.forEach(space => {
        insertAd(space);
      });
      
      // Initialize the processed height to include what we've already seen
      processedPageHeight = window.innerHeight;
    }, 1000);
  });


  // We must be responsive
  window.addEventListener('resize', debounce(() => {
    // Remove existing ads
    document.querySelectorAll('.extension-added-ad').forEach(el => el.remove());
    
    // Find new whitespaces and insert ads
    const whitespaces = findWhiteSpaces();
    whitespaces.forEach(space => {
      insertAd(space);
    });
  }, 500));
  

  window.addEventListener('scroll', debounce(() => {
    const currentScrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    // Only process if we've scrolled to new territory
    if (currentScrollY + viewportHeight > processedPageHeight) {
      console.log("Checking for new whitespaces after scrolling...");
      
      // Update how far we've processed
      processedPageHeight = currentScrollY + viewportHeight;
      
      // Find new whitespaces but only in the newly visible area
      const newWhitespaces = findWhiteSpacesInRange(
        currentScrollY - 100, // A bit above current scroll position
        processedPageHeight + 200 // A bit below the visible area
      );
      
      console.log(`Found ${newWhitespaces.length} new spaces after scrolling`);
      
      // Insert ads in the new spaces
      newWhitespaces.forEach(space => {
        insertAd(space);
      });
    }
  }, 500));

  
  //endregion

  function debounce(func, wait) {
    let timeout;
    return function() {
      clearTimeout(timeout);
      timeout = setTimeout(func, wait);
    };
  }
  
  function findEmptySpaces() {
    console.log("Finding empty spaces...");
    const emptySpaces = findWhiteSpaces();
    console.log(`Found ${emptySpaces.length} empty spaces:`, emptySpaces);
    // For each empty space, insert an ad
    emptySpaces.forEach(space => {
      insertAd(space);
    });
  }

  // Modified whitespace finder that only looks in a specific vertical range
function findWhiteSpacesInRange(topBound, bottomBound) {
    // Try grid-based detection first but only in the specified range
    let spaces = findWhiteSpacesGridInRange(topBound, bottomBound);
    
    // If grid method didn't find enough spaces, try margin analysis
    if (spaces.length < 2) {
      spaces = spaces.concat(findWhiteSpacesMarginsInRange(topBound, bottomBound));
    }
    
    // Filter out overlapping spaces
    spaces = filterOverlappingSpaces(spaces);
    
    // Break up large spaces into smaller ones
    spaces = subdivideSpaces(spaces);
    
    return spaces;
  }


  // Modified grid-based whitespace detection that looks only in a specific vertical range
function findWhiteSpacesGridInRange(topBound, bottomBound) {
    const whitespaces = [];
    const gridSize = 50; // Size of each grid cell in pixels
    const minAdSize = 100; // Minimum size for an ad to be worth placing
    
    // Create a grid representing only the viewport range we're interested in
    const viewportWidth = window.innerWidth;
    const rangeHeight = bottomBound - topBound;
    
    // Convert bounds to grid coordinates
    const startRow = Math.floor(topBound / gridSize);
    const endRow = Math.ceil(bottomBound / gridSize);
    const numRows = endRow - startRow;
    
    // Create a 2D array to track occupied spaces
    const grid = Array(numRows).fill()
      .map(() => Array(Math.ceil(viewportWidth / gridSize)).fill(false));
    
    // Mark grid cells that contain DOM elements
    const elements = document.querySelectorAll('*');
    elements.forEach(element => {
      if (element.className === 'extension-added-ad') return; // Skip our own ads
      
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return; // Skip invisible elements
      
      // Convert viewport coordinates to page coordinates
      const absoluteTop = rect.top + window.scrollY;
      const absoluteBottom = rect.bottom + window.scrollY;
      
      // Skip if element is outside our range
      if (absoluteBottom < topBound || absoluteTop > bottomBound) return;
      
      // Mark cells occupied by this element
      const elementStartRow = Math.max(0, Math.floor((absoluteTop - topBound) / gridSize));
      const elementEndRow = Math.min(numRows - 1, Math.ceil((absoluteBottom - topBound) / gridSize));
      const startCol = Math.max(0, Math.floor(rect.left / gridSize));
      const endCol = Math.min(grid[0].length - 1, Math.ceil(rect.right / gridSize));
      
      for (let row = elementStartRow; row <= elementEndRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          if (row >= 0 && row < grid.length) {
            grid[row][col] = true;
          }
        }
      }
    });
    
    // Find contiguous empty regions (similar to your original code)
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        if (grid[row][col]) continue; // Skip occupied cells
        
        // Expand to find the largest empty rectangle starting at this cell
        let width = 1;
        let height = 1;
        
        // Expand horizontally
        while (col + width < grid[0].length && !grid[row][col + width]) {
          width++;
        }
        
        // Expand vertically
        let canExpandVertically = true;
        while (canExpandVertically && row + height < grid.length) {
          for (let c = col; c < col + width; c++) {
            if (grid[row + height][c]) {
              canExpandVertically = false;
              break;
            }
          }
          if (canExpandVertically) height++;
        }
        
        // Convert back to pixel dimensions and adjust for the range offset
        const pixelWidth = width * gridSize;
        const pixelHeight = height * gridSize;
        
        // Only add if space is large enough
        if (pixelWidth >= minAdSize && pixelHeight >= minAdSize) {
          whitespaces.push({
            left: col * gridSize,
            top: (row + startRow) * gridSize, // Adjust back to page coordinates
            width: pixelWidth,
            height: pixelHeight
          });
          
          // Mark this area as occupied to avoid overlapping ads
          for (let r = row; r < row + height; r++) {
            for (let c = col; c < col + width; c++) {
              if (r < grid.length) {
                grid[r][c] = true;
              }
            }
          }
        }
      }
    }
    
    return whitespaces;
  }
  
  // Modified margin analysis for the specified range
  function findWhiteSpacesMarginsInRange(topBound, bottomBound) {
    const whitespaces = [];
    const elements = document.querySelectorAll('body > *');
    const minMargin = 40; // Minimum margin size to consider
    
    elements.forEach(element => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      
      // Convert viewport coordinates to page coordinates
      const absoluteTop = rect.top + window.scrollY;
      const absoluteBottom = rect.bottom + window.scrollY;
      
      // Skip if element is outside our range
      if (absoluteBottom < topBound || absoluteTop > bottomBound) return;
      
      // Check right margin
      const rightMargin = parseInt(style.marginRight);
      if (rightMargin >= minMargin) {
        whitespaces.push({
          left: rect.right,
          top: absoluteTop,
          width: rightMargin,
          height: rect.height
        });
      }
      
      // Check bottom margin
      const bottomMargin = parseInt(style.marginBottom);
      if (bottomMargin >= minMargin) {
        whitespaces.push({
          left: rect.left,
          top: absoluteBottom,
          width: rect.width,
          height: bottomMargin
        });
      }
    });
    
    return whitespaces;
  }


// Strategy 1: Grid-based approach
function findWhiteSpacesGrid() {
    const whitespaces = [];
    const gridSize = 25; // Size of each grid cell in pixels
    const minAdSize = 50; // Minimum size for an ad to be worth placing
    
    // Create a grid representing the viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Create a 2D array to track occupied spaces
    const grid = Array(Math.ceil(viewportHeight / gridSize)).fill()
      .map(() => Array(Math.ceil(viewportWidth / gridSize)).fill(false));
    
    // Mark grid cells that contain DOM elements
    const elements = document.querySelectorAll('*');
    elements.forEach(element => {
      if (element.className === 'extension-added-ad') return; // Skip our own ads
      
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return; // Skip invisible elements
      
      // Mark cells occupied by this element
      const startRow = Math.max(0, Math.floor(rect.top / gridSize));
      const endRow = Math.min(grid.length - 1, Math.ceil(rect.bottom / gridSize));
      const startCol = Math.max(0, Math.floor(rect.left / gridSize));
      const endCol = Math.min(grid[0].length - 1, Math.ceil(rect.right / gridSize));
      
      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          grid[row][col] = true;
        }
      }
    });
    
    // Find contiguous empty regions
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        if (grid[row][col]) continue; // Skip occupied cells
        
        // Expand to find the largest empty rectangle starting at this cell
        let width = 1;
        let height = 1;
        
        // Expand horizontally
        while (col + width < grid[0].length && !grid[row][col + width]) {
          width++;
        }
        
        // Expand vertically
        let canExpandVertically = true;
        while (canExpandVertically && row + height < grid.length) {
          for (let c = col; c < col + width; c++) {
            if (grid[row + height][c]) {
              canExpandVertically = false;
              break;
            }
          }
          if (canExpandVertically) height++;
        }
        
        // Convert back to pixel dimensions
        const pixelWidth = width * gridSize;
        const pixelHeight = height * gridSize;
        
        // Only add if space is large enough
        if (pixelWidth >= minAdSize && pixelHeight >= minAdSize) {
          whitespaces.push({
            left: col * gridSize,
            top: row * gridSize,
            width: pixelWidth,
            height: pixelHeight
          });
          
          // Mark this area as occupied to avoid overlapping ads
          for (let r = row; r < row + height; r++) {
            for (let c = col; c < col + width; c++) {
              grid[r][c] = true;
            }
          }
        }
      }
    }
    
    return whitespaces;
  }
  
  // Strategy 2: Margin/Padding analysis
  function findWhiteSpacesMargins() {
    const whitespaces = [];
    const elements = document.querySelectorAll('body > *');
    const minMargin = 40; // Minimum margin size to consider
    
    elements.forEach(element => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      
      // Check right margin
      const rightMargin = parseInt(style.marginRight);
      if (rightMargin >= minMargin) {
        whitespaces.push({
          left: rect.right,
          top: rect.top,
          width: rightMargin,
          height: rect.height
        });
      }
      
      // Check bottom margin
      const bottomMargin = parseInt(style.marginBottom);
      if (bottomMargin >= minMargin) {
        whitespaces.push({
          left: rect.left,
          top: rect.bottom,
          width: rect.width,
          height: bottomMargin
        });
      }
    });
    
    return whitespaces;
  }
  
  // Strategy 3: Fixed positions - place ads in common whitespace areas
  function findFixedPositionWhitespaces() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const whitespaces = [];
    
    // Common places for whitespace:
    
    // 1. Right sidebar
    const rightSidebarWidth = Math.min(300, viewportWidth * 0.2);
    if (viewportWidth > 1200) { // Only on wider screens
      whitespaces.push({
        left: viewportWidth - rightSidebarWidth - 20,
        top: 100,
        width: rightSidebarWidth,
        height: viewportHeight - 200
      });
    }
    
    // 2. Between major content sections (need to adjust based on actual page analysis)
    // This would require identifying major content sections
    
    // 3. Footer area
    whitespaces.push({
      left: 50,
      top: viewportHeight - 150,
      width: viewportWidth - 100,
      height: 100
    });
    
    return whitespaces;
  }
  
  // Ensure they are not too large
  function subdivideSpaces(spaces) {
    const maxWidth = 300; // Maximum width for an ad
    const maxHeight = 250; // Maximum height for an ad
    const result = [];
    
    spaces.forEach(space => {
      // If space is too wide, split horizontally
      if (space.width > maxWidth * 1.5) {
        const columns = Math.floor(space.width / maxWidth);
        const columnWidth = Math.floor(space.width / columns);
        
        for (let i = 0; i < columns; i++) {
          result.push({
            left: space.left + (i * columnWidth),
            top: space.top,
            width: columnWidth,
            height: Math.min(space.height, maxHeight)
          });
        }
      } 
      // If space is too tall, split vertically
      else if (space.height > maxHeight * 1.5) {
        const rows = Math.floor(space.height / maxHeight);
        const rowHeight = Math.floor(space.height / rows);
        
        for (let i = 0; i < rows; i++) {
          result.push({
            left: space.left,
            top: space.top + (i * rowHeight),
            width: Math.min(space.width, maxWidth),
            height: rowHeight
          });
        }
      } 
      // Otherwise just limit the size
      else {
        result.push({
          left: space.left,
          top: space.top,
          width: Math.min(space.width, maxWidth),
          height: Math.min(space.height, maxHeight)
        });
      }
    });
    
    return result;
  }

  function findWhiteSpaces() {
    // Try grid-based detection first
    let spaces = findWhiteSpacesGrid();
    
    // If grid method didn't find enough spaces, try margin analysis
    if (spaces.length < 2) {
      console.log("Trying to find margin")
      spaces = spaces.concat(findWhiteSpacesMargins());
    }
    
    // If we still need more ad spaces, use fixed positions
    if (spaces.length < 3) {
       console.log("Trying to find fixed position")
      spaces = spaces.concat(findFixedPositionWhitespaces());
    }
    
    // Filter out overlapping spaces
    spaces = filterOverlappingSpaces(spaces);
    
    // Break up large spaces into smaller ones
    spaces = subdivideSpaces(spaces);
    
    console.log("Final ad spaces:", spaces);
    return spaces;
  }
  
  // Helper function to remove overlapping whitespaces
  function filterOverlappingSpaces(spaces) {
    const result = [];
    
    // Sort by area (largest first)
    spaces.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    spaces.forEach(space => {
      // Check if this space overlaps with any space already in result
      const overlaps = result.some(existing => {
        return !(
          space.left >= existing.left + existing.width ||
          space.left + space.width <= existing.left ||
          space.top >= existing.top + existing.height ||
          space.top + space.height <= existing.top
        );
      });
      
      if (!overlaps) {
        result.push(space);
      }
    });
    
    return result;
  }

  
  const adImages = ['images/add1.png', 'images/add2.png', 'images/add3.png']; // These are all stolen images from walmart.com
  const adLink = 'https://www.walmart.com/'; // Send them to the home page
  
  function insertAd(space) {
    // Create container for the ad
    const adContainer = document.createElement('div');
    adContainer.className = 'extension-added-ad';
    adContainer.style.width = space.width + 'px';
    adContainer.style.height = space.height + 'px';
    adContainer.style.position = 'absolute';
    adContainer.style.left = space.left + 'px';
    adContainer.style.top = space.top + 'px';
    
    // Create link element
    const link = document.createElement('a');
    link.href = adLink;
    link.target = '_blank'; // Open in new tab
    
    // Create image element
    const img = document.createElement('img');
    // Pick a random image from your collection
    const randomIndex = Math.floor(Math.random() * adImages.length);
    // Fix the image path - include the full extension URL
    img.src = chrome.runtime.getURL(adImages[randomIndex]);
    console.log("Trying to load image:", img.src); // Debugging
    img.onerror = () => console.error("Failed to load image:", img.src);
    img.onload = () => console.log("Successfully loaded image:", img.src);
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    
    // Assemble the elements
    link.appendChild(img);
    adContainer.appendChild(link);
    document.body.appendChild(adContainer);
  }