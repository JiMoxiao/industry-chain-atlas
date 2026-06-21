import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { StatePanel } from "@/components/StatePanel";

const Home = lazy(() => import("@/pages/Home"));
const FusionPage = lazy(() => import("@/pages/FusionPage"));
const ChainPage = lazy(() => import("@/pages/ChainPage"));

export default function App() {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<RouteLoadingState />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/fusion" element={<FusionPage />} />
            <Route path="/chain/:slug" element={<ChainPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </PageErrorBoundary>
  );
}

function RouteLoadingState() {
  return (
    <AppLayout>
      <StatePanel
        title="页面正在加载"
        description="正在按需拉取当前页面所需的代码与研究数据，通常只在首次进入该页面时出现。"
        className="min-h-[320px]"
      />
    </AppLayout>
  );
}
