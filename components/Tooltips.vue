<template>
  <div class="py-10 h-full w-full">
    <!--- more free and premium Tailwind CSS components at https://tailwinduikit.com/ --->

    <div
      class="container mx-auto px-6 flex flex-col items-start pl-12 md:pl-0 md:items-center"
    >
      <div class="h-0 md:h-12"></div>
      <dh-component>
        <div class="flex-col md:flex-row flex items-center md:justify-center">
          <!--Code Block for white tooltip starts-->
          <a
            tabindex="0"
            role="link"
            aria-label="tooltip 1"
            class="focus:outline-none focus:ring-gray-300 rounded-full focus:ring-offset-2 focus:ring-2 focus:bg-gray-200 relative mt-20 md:mt-0"
            onmouseover="showTooltip(1)"
            onfocus="showTooltip(1)"
            onmouseout="hideTooltip(1)"
          >
            <div class="cursor-pointer">
              <svg
                aria-haspopup="true"
                xmlns="http://www.w3.org/2000/svg"
                class="icon icon-tabler icon-tabler-info-circle"
                width="25"
                height="25"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="#A0AEC0"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" />
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
                <polyline points="11 12 12 12 12 16 13 16" />
              </svg>
            </div>
            <div
              id="tooltip1"
              role="tooltip"
              class="z-20 -mt-20 w-64 absolute transition duration-150 ease-in-out left-0 ml-8 shadow-lg bg-white p-4 rounded"
            >
              <svg
                class="absolute left-0 -ml-2 bottom-0 top-0 h-full"
                width="9px"
                height="16px"
                viewBox="0 0 9 16"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
              >
                <g
                  id="Page-1"
                  stroke="none"
                  stroke-width="1"
                  fill="none"
                  fill-rule="evenodd"
                >
                  <g
                    id="Tooltips-"
                    transform="translate(-874.000000, -1029.000000)"
                    fill="#FFFFFF"
                  >
                    <g
                      id="Group-3-Copy-16"
                      transform="translate(850.000000, 975.000000)"
                    >
                      <g
                        id="Group-2"
                        transform="translate(24.000000, 0.000000)"
                      >
                        <polygon
                          id="Triangle"
                          transform="translate(4.500000, 62.000000) rotate(-90.000000) translate(-4.500000, -62.000000) "
                          points="4.5 57.5 12.5 66.5 -3.5 66.5"
                        ></polygon>
                      </g>
                    </g>
                  </g>
                </g>
              </svg>
              <p class="text-sm font-bold text-gray-800 pb-1">
                Keep track of follow ups
              </p>
              <p class="text-xs leading-4 text-gray-600 pb-3">
                Reach out to more prospects at the right moment.
              </p>
              <div class="flex justify-between">
                <div class="flex items-center">
                  <span class="text-xs font-bold text-indigo-700"
                    >Step 1 of 4</span
                  >
                </div>
                <div class="flex items-center">
                  <button
                    class="focus:outline-none focus:text-gray-400 text-xs text-gray-600 underline mr-2 cursor-pointer"
                  >
                    Skip Tour
                  </button>
                  <button
                    onblur="hideTooltip(1)"
                    class="focus:ring-2 focus:ring-offset-2 focus:ring-indigo-700 focus:bg-indigo-400 focus:outline-none bg-indigo-700 transition duration-150 ease-in-out hover:bg-indigo-600 rounded text-white px-5 py-1 text-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </a>
          <!--Code Block for white tooltip ends-->

          <!--Code Block for indigo tooltip starts-->
          <a
            tabindex="0"
            role="link"
            aria-label="tooltip 2"
            class="focus:outline-none focus:ring-gray-300 rounded-full focus:ring-offset-2 focus:ring-2 focus:bg-gray-200 relative my-28 md:my-0 md:mx-64"
            onmouseover="showTooltip(2)"
            onfocus="showTooltip(2)"
            onmouseout="hideTooltip(2)"
          >
            <div class="cursor-pointer">
              <svg
                aria-haspopup="true"
                xmlns="http://www.w3.org/2000/svg"
                class="icon icon-tabler icon-tabler-info-circle"
                width="25"
                height="25"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="#A0AEC0"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" />
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
                <polyline points="11 12 12 12 12 16 13 16" />
              </svg>
            </div>
            <div
              id="tooltip2"
              role="tooltip"
              class="z-20 -mt-20 w-64 absolute transition duration-150 ease-in-out left-0 ml-8 shadow-lg bg-indigo-700 p-4 rounded"
            >
              <svg
                class="absolute left-0 -ml-2 bottom-0 top-0 h-full"
                width="9px"
                height="16px"
                viewBox="0 0 9 16"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
              >
                <g
                  id="Page-1"
                  stroke="none"
                  stroke-width="1"
                  fill="none"
                  fill-rule="evenodd"
                >
                  <g
                    id="Tooltips-"
                    transform="translate(-874.000000, -1029.000000)"
                    fill="#4c51bf"
                  >
                    <g
                      id="Group-3-Copy-16"
                      transform="translate(850.000000, 975.000000)"
                    >
                      <g
                        id="Group-2"
                        transform="translate(24.000000, 0.000000)"
                      >
                        <polygon
                          id="Triangle"
                          transform="translate(4.500000, 62.000000) rotate(-90.000000) translate(-4.500000, -62.000000) "
                          points="4.5 57.5 12.5 66.5 -3.5 66.5"
                        ></polygon>
                      </g>
                    </g>
                  </g>
                </g>
              </svg>
              <p class="text-sm font-bold text-white pb-1">
                Keep track of follow ups
              </p>
              <p class="text-xs leading-4 text-white pb-3">
                Reach out to more prospects at the right moment.
              </p>
              <div class="flex justify-between">
                <div class="flex items-center">
                  <span class="text-xs font-bold text-white">Step 1 of 4</span>
                </div>
                <div class="flex items-center">
                  <button
                    class="focus:outline-none focus:underline focus:text-indigo-200 text-xs text-white underline mr-2 cursor-pointer"
                  >
                    Skip Tour
                  </button>
                  <button
                    onblur="hideTooltip(2)"
                    class="focus:ring-2 focus:ring-offset-2 focus:ring-indigo-700 focus:bg-indigo-400 focus:outline-none focus:text-white bg-white transition duration-150 ease-in-out focus:outline-none hover:bg-gray-200 rounded text-indigo-700 px-5 py-1 text-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </a>
          <!--Code Block for indigo tooltip ends-->

          <!--Code Block for gray tooltip starts-->
          <a
            tabindex="0"
            aria-label="tooltip 3"
            role="link"
            class="focus:outline-none focus:ring-gray-300 rounded-full focus:ring-offset-2 focus:ring-2 focus:bg-gray-200 relative"
            onmouseover="showTooltip(3)"
            onfocus="showTooltip(3)"
            onmouseout="hideTooltip(3)"
          >
            <div class="cursor-pointer">
              <svg
                aria-haspopup="true"
                xmlns="http://www.w3.org/2000/svg"
                class="icon icon-tabler icon-tabler-info-circle"
                width="25"
                height="25"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="#A0AEC0"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" />
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
                <polyline points="11 12 12 12 12 16 13 16" />
              </svg>
            </div>
            <div
              id="tooltip3"
              role="tooltip"
              class="z-20 -mt-20 w-64 absolute transition duration-150 ease-in-out left-0 ml-8 shadow-lg bg-gray-800 p-4 rounded"
            >
              <svg
                class="absolute left-0 -ml-2 bottom-0 top-0 h-full"
                width="9px"
                height="16px"
                viewBox="0 0 9 16"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
              >
                <g
                  id="Page-1"
                  stroke="none"
                  stroke-width="1"
                  fill="none"
                  fill-rule="evenodd"
                >
                  <g
                    id="Tooltips-"
                    transform="translate(-874.000000, -1029.000000)"
                    fill="#2D3748"
                  >
                    <g
                      id="Group-3-Copy-16"
                      transform="translate(850.000000, 975.000000)"
                    >
                      <g
                        id="Group-2"
                        transform="translate(24.000000, 0.000000)"
                      >
                        <polygon
                          id="Triangle"
                          transform="translate(4.500000, 62.000000) rotate(-90.000000) translate(-4.500000, -62.000000) "
                          points="4.5 57.5 12.5 66.5 -3.5 66.5"
                        ></polygon>
                      </g>
                    </g>
                  </g>
                </g>
              </svg>
              <p class="text-sm font-bold text-white pb-1">
                Keep track of follow ups
              </p>
              <p class="text-xs leading-4 text-white pb-3">
                Reach out to more prospects at the right moment.
              </p>
              <div class="flex justify-between">
                <div class="flex items-center">
                  <span class="text-xs font-bold text-white">Step 1 of 4</span>
                </div>
                <div class="flex items-center">
                  <button
                    class="focus:outline-none focus:underline focus:text-indigo-200 text-xs text-white underline mr-2 cursor-pointer"
                  >
                    Skip Tour
                  </button>
                  <button
                    onblur="hideTooltip(3)"
                    class="focus:ring-2 focus:ring-offset-2 focus:ring-indigo-700 focus:bg-indigo-400 focus:outline-none focus:text-white bg-white transition duration-150 ease-in-out focus:outline-none hover:bg-gray-200 rounded text-gray-600 px-5 py-1 text-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </a>
          <!--Code Block for gray tooltip ends-->
        </div>
      </dh-component>
      <div class="h-12"></div>
    </div>
  </div>
  <!--  <script>function showTooltip(flag) {-->
  <!--    switch (flag) {-->
  <!--      case 1:-->
  <!--        document.getElementById("tooltip1").classList.remove("hidden");-->
  <!--        break;-->
  <!--      case 2:-->
  <!--        document.getElementById("tooltip2").classList.remove("hidden");-->
  <!--        break;-->
  <!--      case 3:-->
  <!--        document.getElementById("tooltip3").classList.remove("hidden");-->
  <!--        break;-->
  <!--    }-->
  <!--  }-->
  <!--  function hideTooltip(flag) {-->
  <!--    switch (flag) {-->
  <!--      case 1:-->
  <!--        document.getElementById("tooltip1").classList.add("hidden");-->
  <!--        break;-->
  <!--      case 2:-->
  <!--        document.getElementById("tooltip2").classList.add("hidden");-->
  <!--        break;-->
  <!--      case 3:-->
  <!--        document.getElementById("tooltip3").classList.add("hidden");-->
  <!--        break;-->
  <!--    }-->
  <!--  }-->
  <!--  </script>-->
</template>
