import { useState, useEffect, lazy, Suspense } from "react"
import { navigate, getBasePath } from "@/lib/navigation";
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LocalDbUploader } from "@/components/LocalDbUploader"
import { GoogleAnalytics } from "@/components/GoogleAnalytics"
import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useTheme } from "@/hooks/useTheme"
import { AppHeader } from "@/components/Layout/AppHeader"
import { NavigationTabs } from "@/components/Layout/NavigationTabs"
import { Button } from "@/components/ui/button"
import { Toaster } from "sonner"
import { useRouteMetadata } from "@/hooks/useRouteMetadata"
import { incrementHistoryCount, navigateBack } from "@/lib/utils"
import { OnboardingModal } from "@/components/OnboardingModal"
import { QuotaBanner } from "@/components/QuotaBanner"

// Lazy load heavy components to code-split the application
const Home = lazy(() => import("@/components/Home").then(module => ({ default: module.Home })))
const AdvancedSearch = lazy(() => import("@/components/AdvancedSearch").then(module => ({ default: module.AdvancedSearch })))
const SqlEditor = lazy(() => import("@/components/SqlEditor").then(module => ({ default: module.SqlEditor })))
const AiAssistant = lazy(() => import("@/components/AiAssistant").then(module => ({ default: module.AiAssistant })))
const PublicationsSearch = lazy(() => import("@/components/Publications/PublicationsSearch").then(module => ({ default: module.PublicationsSearch })))
const Settings = lazy(() => import("@/components/Settings").then(module => ({ default: module.Settings })))
const AuthorsSearch = lazy(() => import("@/components/Authors/AuthorsSearch").then(module => ({ default: module.AuthorsSearch })))
const CharactersSearch = lazy(() => import("@/components/Characters/CharactersSearch").then(module => ({ default: module.CharactersSearch })))
const CountryPublications = lazy(() => import("@/components/Publications/CountryPublications").then(module => ({ default: module.CountryPublications })))
const CountryList = lazy(() => import("@/components/Publications/CountryList").then(module => ({ default: module.CountryList })))
const PublicationDetail = lazy(() => import("@/components/Publications/PublicationDetail").then(module => ({ default: module.PublicationDetail })))
const PublisherDetail = lazy(() => import("@/components/Publications/PublisherDetail").then(module => ({ default: module.PublisherDetail })))
const IssueDetail = lazy(() => import("@/components/Publications/IssueDetail").then(module => ({ default: module.IssueDetail })))
const SuggestionForm = lazy(() => import("@/components/SuggestionForm").then(module => ({ default: module.SuggestionForm })))

import { PageLoadingSkeleton } from "@/components/PageLoadingSkeleton"

import { routes } from "@/lib/routes"

// Reusable loading fallback
const TabFallback = () => <PageLoadingSkeleton />

function App() {
  const { i18n, t } = useTranslation();
  useTheme(); // initialise theme from localStorage / system preference
  const [activeTab, setActiveTab] = useState("home");
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM inducks_story LIMIT 10");

  const [selectedStorycode, setSelectedStorycode] = useState<string | null>(null);
  const [selectedIssuecode, setSelectedIssuecode] = useState<string | null>(null);
  const [selectedPersoncode, setSelectedPersoncode] = useState<string | null>(null);
  const [selectedCharactercode, setSelectedCharactercode] = useState<string | null>(null);
  const [selectedCountrycode, setSelectedCountrycode] = useState<string | null>(null);
  const [selectedPublicationcode, setSelectedPublicationcode] = useState<string | null>(null);
  const [selectedPublisherid, setSelectedPublisherid] = useState<string | null>(null);

  // Call route metadata hook to update page title and description
  useRouteMetadata({
    activeTab,
    selectedStorycode,
    selectedIssuecode,
    selectedPersoncode,
    selectedCharactercode,
    selectedCountrycode,
    selectedPublicationcode,
    selectedPublisherid
  });

  useEffect(() => {
    const handleUrlRouting = () => {
      incrementHistoryCount();
      
      const baseUrl = import.meta.env.BASE_URL || "/";
      const pathname = window.location.pathname;
      const hash = window.location.hash;
      
      let rawPath = "";
      if (hash && hash.length > 2) {
        // Support legacy hash URLs
        rawPath = hash.substring(2);
      } else {
        // Strip base URL
        if (pathname.startsWith(baseUrl)) {
          rawPath = pathname.substring(baseUrl.length);
        } else {
          rawPath = pathname.startsWith('/') ? pathname.substring(1) : pathname;
        }
      }

      if (!rawPath || rawPath === "index.html") {
        setActiveTab("home");
        return;
      }

      // decodeURIComponent doesn't convert '+' to space automatically
      const decodedPath = decodeURIComponent(rawPath.replace(/\+/g, "%20"));
      const [pathPart, queryPart] = decodedPath.split("?");
      
      // Reset all codes
      setSelectedStorycode(null);
      setSelectedIssuecode(null);
      setSelectedPersoncode(null);
      setSelectedCharactercode(null);
      setSelectedCountrycode(null);
      setSelectedPublicationcode(null);
      setSelectedPublisherid(null);


      const parts = pathPart.split("/").filter(Boolean);
      const rootPart = parts[0];

      if (rootPart === "home") {
        setActiveTab("home");
      } else if (rootPart === "settings") {
        setActiveTab("settings");
      } else if (rootPart === "entries" || rootPart === "stories") {
        setActiveTab("stories");
        if (parts[1] === "story" && parts[2]) {
          const code = parts.slice(2).join("/");
          setSelectedStorycode(code);
        } else if (parts[1] && parts[1] !== "story") {
          const code = parts.slice(1).join("/");
          setSelectedStorycode(code);
        }
      } else if (rootPart === "countries" || rootPart === "publications") {
        // We support both /countries/... and /publications/... for legacy links
        if (parts.length >= 4) {
          // e.g. /countries/de/LTB/613 -> issue de/LTB 613
          const issueCode = `${parts[1]}/${parts[2]} ${parts.slice(3).join("/")}`;
          setSelectedIssuecode(issueCode);
          setActiveTab("publications");
        } else if (parts.length === 3) {
          // e.g. /countries/de/LTB -> publication de/LTB
          const pubCode = `${parts[1]}/${parts[2]}`;
          setSelectedPublicationcode(pubCode);
          setActiveTab("publications");
        } else if (parts.length === 2) {
          // e.g. /countries/de -> country de
          setSelectedCountrycode(parts[1]);
          setActiveTab("countries");
        } else if (rootPart === "countries") {
          setActiveTab("countries");
        } else {
          setActiveTab("publications");
        }
      } else if (rootPart === "authors") {
        setActiveTab("authors");
        if (parts[1]) setSelectedPersoncode(parts.slice(1).join("/"));
      } else if (rootPart === "characters") {
        setActiveTab("characters");
        if (parts[1]) setSelectedCharactercode(parts.slice(1).join("/"));
      } else if (rootPart === "publishers") {
        setActiveTab("publications");
        setSelectedPublicationcode(null);
        setSelectedStorycode(null);
        setSelectedIssuecode(null);
        if (parts[1]) setSelectedPublisherid(parts.slice(1).join("/"));
      } else if (rootPart === "sql") {
        setActiveTab("sql");
      } else if (rootPart === "suggestions") {
        setActiveTab("suggestions");
      } else {
        setActiveTab("stories");
      }
    };

    handleUrlRouting();
    window.addEventListener("popstate", handleUrlRouting);
    window.addEventListener("hashchange", handleUrlRouting);
    
    const handleSwitchTab = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        handleTabChange(customEvent.detail);
      }
    };
    window.addEventListener("switch-tab", handleSwitchTab);
    
    return () => {
      window.removeEventListener("popstate", handleUrlRouting);
      window.removeEventListener("hashchange", handleUrlRouting);
      window.removeEventListener("switch-tab", handleSwitchTab);
    };
  }, []);

  const pushHashState = (expectedHash: string) => {
    const base = getBasePath();
    const cleanHash = expectedHash.startsWith('/') ? expectedHash : `/${expectedHash}`;
    
    // Compare actual URL (path + hash without query) to avoid duplicate pushState calls
    const currentCleanHash = window.location.pathname; // It's better to compare pathname since we use path routing now
    // Actually expectedHash includes query string sometimes. Let's just compare the generated full path.
    const expectedUrl = `${base}${cleanHash}`;
    
    if (window.location.pathname + window.location.search === expectedUrl) {
      return;
    }
    
    window.history.pushState(null, "", expectedUrl);
  };

  useEffect(() => {
    const rootPrefix = activeTab === "stories" ? "entries" : activeTab;
    
    // Get existing query parameters to preserve them (like pos)
    const currentHash = window.location.hash;
    const queryIndex = currentHash.indexOf("?");
    const queryStr = queryIndex !== -1 ? currentHash.substring(queryIndex) : "";
    
    if (activeTab === "settings") {
      pushHashState(routes.settings() + queryStr);
    } else if (activeTab === "suggestions") {
      pushHashState(routes.suggestions() + queryStr);
    } else if (selectedStorycode) {
      pushHashState(routes.story(selectedStorycode) + queryStr);
    } else if (selectedIssuecode) {
      pushHashState(routes.issue(selectedIssuecode) + queryStr);
    } else if (selectedPersoncode) {
      pushHashState(routes.author(selectedPersoncode) + queryStr);
    } else if (selectedCharactercode) {
      pushHashState(routes.character(selectedCharactercode) + queryStr);
    } else if (selectedPublisherid) {
      pushHashState(routes.publisher(selectedPublisherid) + queryStr);
    } else if (selectedPublicationcode) {
      pushHashState(routes.publication(selectedPublicationcode) + queryStr);
    } else if (selectedCountrycode) {
      pushHashState(routes.country(selectedCountrycode) + queryStr);
    } else {
      pushHashState(`#/${rootPrefix}` + queryStr);
    }
  }, [
    activeTab, 
    selectedStorycode, 
    selectedIssuecode, 
    selectedPersoncode, 
    selectedCharactercode, 
    selectedCountrycode, 
    selectedPublisherid,
    selectedPublicationcode
  ]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedStorycode(null);
    setSelectedIssuecode(null);
    setSelectedPersoncode(null);
    setSelectedCharactercode(null);
    setSelectedCountrycode(null);
    setSelectedPublisherid(null);
    setSelectedPublicationcode(null);
  };

  return (
    <TooltipProvider>
      <GoogleAnalytics activeTab={activeTab} />
      <div id="main-content" className="h-screen overflow-y-auto overflow-x-hidden bg-background text-foreground">
        <div className="flex flex-col h-screen shrink-0">
          {/* Main Header */}
          <AppHeader
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

        {/* Global Banner for Turso Quota Errors */}
        <QuotaBanner onGoToSettings={() => setActiveTab("settings")} />

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <NavigationTabs 
            activeTab={activeTab} 
            isDetailPage={!!(selectedStorycode || selectedIssuecode || selectedPersoncode || selectedCharactercode || selectedPublicationcode || selectedPublisherid || selectedCountrycode)} 
          />

          {/* Content Viewport */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <TabsContent value="home" className="h-full m-0 p-0 border-none outline-none overflow-auto">
              {activeTab === "home" && (
                <Suspense fallback={<TabFallback />}>
                  <Home />
                </Suspense>
              )}
            </TabsContent>

            <TabsContent value="stories" className="h-full m-0 p-0 border-none outline-none overflow-hidden">
              {activeTab === "stories" && (
                <Suspense fallback={<TabFallback />}>
                  <AdvancedSearch
                    selectedStorycode={selectedStorycode}
                    setSelectedStorycode={setSelectedStorycode}
                    selectedIssuecode={selectedIssuecode}
                    setSelectedIssuecode={setSelectedIssuecode}
                  />
                </Suspense>
              )}
            </TabsContent>

            <TabsContent value="sql" className="h-full m-0 p-0 border-none outline-none bg-surface overflow-auto">
              {activeTab === "sql" && (
                <div className="p-4 lg:px-12">
                  <Suspense fallback={<TabFallback />}>
                    <SqlEditor query={sqlQuery} setQuery={setSqlQuery} />
                  </Suspense>
                </div>
              )}
            </TabsContent>

            <TabsContent value="publications" className="h-full m-0 p-0 border-none outline-none overflow-hidden">
              {activeTab === "publications" && (
                <Suspense fallback={<TabFallback />}>
                  {selectedIssuecode ? (
                    <div className="h-full overflow-y-auto bg-surface-2/20 w-full">
                      <IssueDetail
                        issuecode={selectedIssuecode}
                        onBack={() => navigateBack(() => setSelectedIssuecode(null))}
                        onSelectStory={(code) => {
                          setSelectedStorycode(code)
                          setActiveTab("stories")
                        }}
                      />
                    </div>
                  ) : selectedPublicationcode ? (
                    <div className="h-full overflow-y-auto bg-surface-2/20 w-full">
                      <PublicationDetail
                        publicationcode={selectedPublicationcode}
                        onBack={() => navigateBack(() => setSelectedPublicationcode(null))}
                        onSelectIssue={(code) => setSelectedIssuecode(code)}
                      />
                    </div>
                  ) : selectedPublisherid ? (
                    <div className="h-full overflow-y-auto bg-surface-2/20 w-full">
                      <PublisherDetail
                        publisherid={selectedPublisherid}
                        onBack={() => navigateBack(() => setSelectedPublisherid(null))}
                        onSelectPublication={(code) => setSelectedPublicationcode(code)}
                      />
                    </div>
                  ) : (
                    <PublicationsSearch
                      selectedStorycode={selectedStorycode}
                      setSelectedStorycode={setSelectedStorycode}
                      selectedIssuecode={selectedIssuecode}
                      setSelectedIssuecode={setSelectedIssuecode}
                    />
                  )}
                </Suspense>
              )}
            </TabsContent>

            <TabsContent value="countries" className="h-full m-0 p-0 border-none outline-none overflow-hidden">
              {activeTab === "countries" && (
                <Suspense fallback={<TabFallback />}>
                  {selectedCountrycode ? (
                    <div className="h-full overflow-y-auto bg-surface-2/20 w-full">
                      <CountryPublications
                        countrycode={selectedCountrycode}
                        onBack={() => navigateBack(() => setSelectedCountrycode(null))}
                        onSelectPublication={(code) => {
                          setSelectedPublicationcode(code);
                          setActiveTab("publications"); // go back to publications to show details
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-full overflow-y-auto w-full">
                      <CountryList onSelectCountry={setSelectedCountrycode} />
                    </div>
                  )}
                </Suspense>
              )}
            </TabsContent>

            <TabsContent value="authors" className="h-full m-0 p-0 border-none outline-none overflow-hidden">
              {activeTab === "authors" && (
                <Suspense fallback={<TabFallback />}>
                  <AuthorsSearch
                    selectedAuthorcode={selectedPersoncode}
                    setSelectedAuthorcode={setSelectedPersoncode}
                  />
                </Suspense>
              )}
            </TabsContent>

            <TabsContent value="characters" className="h-full m-0 p-0 border-none outline-none overflow-hidden">
              {activeTab === "characters" && (
                <Suspense fallback={<TabFallback />}>
                  <CharactersSearch
                    selectedCharactercode={selectedCharactercode}
                    setSelectedCharactercode={setSelectedCharactercode}
                  />
                </Suspense>
              )}
            </TabsContent>

            <TabsContent value="settings" className="h-full m-0 p-0 border-none outline-none overflow-y-auto">
              {activeTab === "settings" && (
                <Suspense fallback={<TabFallback />}>
                  <Settings />
                </Suspense>
              )}
            </TabsContent>

            <TabsContent value="suggestions" className="h-full m-0 p-0 border-none outline-none overflow-y-auto">
              {activeTab === "suggestions" && (
                <Suspense fallback={<TabFallback />}>
                  <SuggestionForm />
                </Suspense>
              )}
            </TabsContent>
          </div>
        </Tabs>
          {activeTab === "sql" && (
            <Suspense fallback={null}>
              <AiAssistant onCopyToEditor={(q) => setSqlQuery(q)} />
            </Suspense>
          )}
        </div>
        
        {/* Global Footer for legal mentions (temporairement caché)
        <footer className="px-4 py-4 shrink-0 border-t border-border-subtle bg-surface flex justify-center items-center text-xs text-text-hint">
          <LegalModal />
        </footer>
        */}
      </div>
      <Toaster position="top-center" richColors />
      <OnboardingModal />
    </TooltipProvider>
  )
}

export default App

