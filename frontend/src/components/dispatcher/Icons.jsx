export default function Icon({ name, size = 16 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    style: { display: "block" },
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path
            d="M4 10.5 12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-9.5Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 21.5v-6a2.5 2.5 0 0 1 5 0v6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );

          case "edit":
      return (
        <svg {...common}>
          <path
            d="M12 20h9"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "chevronRight":
      return (
        <svg {...common}>
          <path
            d="M9 18l6-6-6-6"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );


    case "list":
      return (
        <svg {...common}>
          <path
            d="M8 6h13M8 12h13M8 18h13"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "logout":
      return (
        <svg {...common}>
          <path
            d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M14 7l5 5-5 5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19 12H10"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "user":
      return (
        <svg {...common}>
          <path
            d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "settings":
      return (
        <svg {...common}>
          <path
            d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="M19.4 15a1.9 1.9 0 0 0 .38 2.1l.05.06-1.6 2.77-.08-.03a2 2 0 0 0-2.2.44l-.06.05-2.8-1.6.03-.08a2 2 0 0 0-.5-2.34l-.06-.05h-3.2l-.06.05a2 2 0 0 0-.5 2.34l.03.08-2.8 1.6-.06-.05a2 2 0 0 0-2.2-.44l-.08.03-1.6-2.77.05-.06A1.9 1.9 0 0 0 4.6 15l.02-.08-1.6-2.77.08-.03a2 2 0 0 0 2.2-.44l.06-.05 2.8 1.6-.03.08a2 2 0 0 0 .5 2.34l.06.05h3.2l.06-.05a2 2 0 0 0 .5-2.34l-.03-.08 2.8-1.6.06.05a2 2 0 0 0 2.2.44l.08-.03 1.6 2.77-.02.08Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            opacity=".9"
          />
        </svg>
      );

    case "bell":
      return (
        <svg {...common}>
          <path
            d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M10 21a2 2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "truck":
      return (
        <svg {...common}>
          <path
            d="M3 7h11v10H3V7Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M14 10h4l3 3v4h-7V10Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path
            d="M20 12a8 8 0 0 1-13.657 5.657M4 12a8 8 0 0 1 13.657-5.657"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M20 7v5h-5M4 17v-5h5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <path
            d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="M16.3 16.3 21 21"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "route":
      return (
        <svg {...common}>
          <path
            d="M6 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="M18 15a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="M8 7h6a4 4 0 0 1 4 4v4"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M6 9v8a4 4 0 0 0 4 4h4"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "map":
      return (
        <svg {...common}>
          <path
            d="M10 20 4 18V6l6 2 4-2 6 2v12l-6-2-4 2Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M10 8v12M14 6v12"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path
            d="M8 10l4 4 4-4"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 17v3h16v-3"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "shield":
      return (
        <svg {...common}>
          <path
            d="M12 2 20 6v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 12.2 11 13.7 14.8 9.9"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "alert":
      return (
        <svg {...common}>
          <path d="M12 9v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M12 17h.01" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <path
            d="M10.3 4.2 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "close":
      return (
        <svg {...common}>
          <path
            d="M6 6l12 12M18 6 6 18"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );

    case "inbox":
      return (
        <svg {...common}>
          <path
            d="M4 4h16v10l-2 6H6l-2-6V4Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M4 14h5l1.5 2h3L15 14h5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "userx":
      return (
        <svg {...common}>
          <path
            d="M16 21v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="M17 8l4 4M21 8l-4 4"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "gps":
      return (
        <svg {...common}>
          <path
            d="M12 22s6-4.5 6-10a6 6 0 1 0-12 0c0 5.5 6 10 6 10Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M12 13.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
        </svg>
      );

    default:
      return null;
  }
}
